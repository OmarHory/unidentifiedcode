import { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon, SparklesIcon, ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { chatApi, getWebSocketBaseUrl, createReconnectingWebSocket } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../contexts/ChatContext';

export default function ChatInterface({ projectId, onCodeSuggestion }) {
  // Use the chat context instead of local state
  const { 
    messages, 
    sessionId, 
    chatSessions,
    loadChatSessions,
    createChatSession,
    loadChatSession,
    setSessionId,
    sendMessage: sendChatMessage,
    isProcessing: isApiProcessing
  } = useChat();
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const chatContainerRef = useRef(null);
  const wsRef = useRef(null);

  // Add debounce functionality for input
  const debounceTimeout = useRef(null);
  const [localInputMessage, setLocalInputMessage] = useState('');

  // Function to handle input change with debouncing
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setLocalInputMessage(value);
    
    // Clear any pending timeouts
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    // Set a new timeout to update the actual state
    debounceTimeout.current = setTimeout(() => {
      setInputMessage(value);
    }, 100);
  }, []);
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      
      // Close websocket connection when component unmounts
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load chat sessions for this project when the component mounts
  useEffect(() => {
    if (projectId) {
      setIsLoadingSessions(true);
      loadChatSessions(projectId)
        .finally(() => setIsLoadingSessions(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Removed loadChatSessions from deps to prevent infinite calls
  
  // Track WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  // Track if we've shown a reconnection toast to prevent duplicates
  const reconnectToastShownRef = useRef(false);

  // Set up WebSocket connection when session ID changes
  useEffect(() => {
    if (!sessionId) return;
    
    // Clear any existing WebSocket
    if (wsRef.current) {
      console.log('Closing existing WebSocket connection');
      wsRef.current.close(1000, "New connection requested");
      wsRef.current = null;
    }
    
    const wsBaseUrl = getWebSocketBaseUrl();
    const wsUrl = `${wsBaseUrl}/chat/ws/${sessionId}`;
    console.log('Connecting to WebSocket URL:', wsUrl);
    
    // Use the enhanced WebSocket with reconnection
    const ws = createReconnectingWebSocket(wsUrl, {
      debug: true,
      maxReconnectAttempts: 5,
      reconnectInterval: 2000,
      onOpen: () => {
        console.log('WebSocket connection established');
        // Only show toast if we weren't previously connected and this is the initial connection
        if (!wsConnected && !reconnectToastShownRef.current) {
          toast.success('Connected to chat server');
        }
        // Reset reconnection toast flag when successfully connected
        reconnectToastShownRef.current = false;
        setWsConnected(true);
        // Reset loading state if it was stuck
        if (isLoading) {
          setIsLoading(false);
        }
      },
      onMessage: (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'stream_start') {
            // Add an empty message that will be filled in with chunks
            setMessages(prev => [...prev, data.message]);
            setIsLoading(true);
          }
          else if (data.type === 'stream_chunk') {
            // Update the message with the new chunk
            setMessages(prev => {
              const updatedMessages = prev.map(msg => 
                msg.id === data.message_id 
                  ? { ...msg, content: msg.content + data.chunk }
                  : msg
              );
              return updatedMessages;
            });
          }
          else if (data.type === 'stream_end') {
            // Streaming is complete
            setIsLoading(false);
          }
          else if (data.type === 'error') {
            console.error('Error from WebSocket:', data.error);
            toast.error(`Error: ${data.error}`);
            setIsLoading(false);
          }
          else if (data.message) {
            // Legacy non-streaming response
            setMessages(prev => [...prev, data.message]);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          toast.error('Error processing server response');
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        // Don't show any error toasts for WebSocket errors
        // They're handled by the reconnection logic
        
        // Reset loading state if it's stuck due to an error
        if (isLoading) {
          setTimeout(() => {
            setIsLoading(false);
          }, 3000);
        }
      },
      onClose: (event) => {
        console.log('WebSocket connection closed', event?.code, event?.reason);
        // Only update state for unexpected closures
        if (event?.code !== 1000) {
          setWsConnected(false);
        }
        // Reset loading state if it was stuck
        if (isLoading) {
          setTimeout(() => {
            setIsLoading(false);
          }, 3000);
        }
      },
      onReconnect: (attempt) => {
        console.log(`Attempting to reconnect (${attempt})...`);
        // Don't show any reconnection toasts to avoid spam
        // Just set the flag that we're in reconnection mode
        reconnectToastShownRef.current = true;
      },
      onMaxReconnectAttemptsExceeded: () => {
        console.error('Max reconnect attempts exceeded');
        // Only show this critical error toast if we haven't shown a reconnection toast
        if (!reconnectToastShownRef.current) {
          toast.error('Could not connect to chat server. Please refresh the page.');
          reconnectToastShownRef.current = true;
        }
        // Reset loading state if it's stuck due to failed reconnection
        if (isLoading) {
          setIsLoading(false);
        }
      }
    });
    
    wsRef.current = ws;
    
    return () => {
      if (ws) {
        ws.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [sessionId]); // Only recreate when sessionId changes

  // Scroll to bottom when messages change or when loading state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      // Scroll to bottom with a smooth animation
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading, isApiProcessing]);

  async function handleSendMessage() {
    if (!inputMessage.trim()) return;
    
    // Clear the input field immediately for better UX
    const messageContent = inputMessage.trim();
    setLocalInputMessage('');
    setInputMessage('');
    setIsLoading(true);
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
    
    try {
      // Send the message using the chat context
      await sendChatMessage(messageContent);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new chat session
  async function handleCreateNewSession() {
    try {
      setIsLoadingSessions(true);
      await createChatSession(projectId);
      toast.success('New chat session created');
    } catch (error) {
      console.error('Error creating new chat session:', error);
      toast.error('Failed to create new chat session');
    } finally {
      setIsLoadingSessions(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      // Stop listening
      setIsListening(false);
      toast('Voice recognition stopped', { icon: '🔇' });
      
      // If there's a global SpeechRecognition object from a previous session, try to stop it
      if (window.currentSpeechRecognition) {
        try {
          window.currentSpeechRecognition.stop();
        } catch (e) {
          console.error('Error stopping speech recognition:', e);
        }
        window.currentSpeechRecognition = null;
      }
      
      // If there's a media stream, stop it
      if (window.currentMediaStream) {
        window.currentMediaStream.getTracks().forEach(track => track.stop());
        window.currentMediaStream = null;
      }
    } else {
      // Start listening
      setIsListening(true);
      toast('Listening... Speak now', { icon: '🎤' });
      
      console.log('Starting voice recognition...');
      
      try {
        // Check if the browser supports speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          console.log('Web Speech API not supported, falling back to backend API');
          await useMediaRecorderFallback();
          return;
        }
        
        console.log('Creating SpeechRecognition instance...');
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        // Store recognition instance globally to manage lifecycle
        window.currentSpeechRecognition = recognition;
        
        let finalTranscript = '';
        
        recognition.onresult = (event) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Update input with current transcript
          const fullTranscript = finalTranscript + interimTranscript;
          setLocalInputMessage(fullTranscript);
          setInputMessage(fullTranscript);
          
          console.log('Speech recognition result:', fullTranscript);
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error, event);
          
          // Not all errors should stop the recognition
          if (event.error === 'no-speech') {
            // This is a common error that doesn't need to interrupt the flow
            toast('No speech detected. Please try again.', { icon: '🔊' });
          } else if (event.error === 'audio-capture') {
            toast.error('Could not access microphone. Please check permissions.');
            setIsListening(false);
            window.currentSpeechRecognition = null;
          } else if (event.error === 'not-allowed') {
            toast.error('Microphone access denied. Please allow microphone access and try again.');
            setIsListening(false);
            window.currentSpeechRecognition = null;
          } else if (event.error === 'network') {
            toast.error('Network error occurred. Please check your connection.');
            setIsListening(false);
            window.currentSpeechRecognition = null;
            
            // Try to use the fallback method
            useMediaRecorderFallback().catch(fallbackError => {
              console.error('Fallback also failed:', fallbackError);
            });
          } else {
            toast.error(`Speech recognition error: ${event.error}`);
            setIsListening(false);
            window.currentSpeechRecognition = null;
            
            // Try to use the fallback method
            useMediaRecorderFallback().catch(fallbackError => {
              console.error('Fallback also failed:', fallbackError);
            });
          }
        };
        
        recognition.onend = () => {
          console.log('Speech recognition ended');
          
          // Only reset the listening state if we haven't done so already
          if (isListening) {
            setIsListening(false);
          }
          
          window.currentSpeechRecognition = null;
        };
        
        // Start recognition with error handling
        try {
          console.log('Starting speech recognition...');
          recognition.start();
          console.log('Speech recognition started successfully');
        } catch (startError) {
          console.error('Error starting speech recognition:', startError);
          toast.error(`Couldn't start listening: ${startError.message}`);
          setIsListening(false);
          window.currentSpeechRecognition = null;
          
          // Try to use the fallback method
          useMediaRecorderFallback().catch(fallbackError => {
            console.error('Fallback also failed:', fallbackError);
          });
        }
      } catch (error) {
        console.error('Speech recognition error:', error);
        toast.error(`Speech recognition error: ${error.message}`);
        setIsListening(false);
        
        // Try to use the fallback method
        useMediaRecorderFallback().catch(fallbackError => {
          console.error('Fallback also failed:', fallbackError);
        });
      }
    }
  };
  
  // Fallback function that uses MediaRecorder API + backend transcription
  const useMediaRecorderFallback = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      window.currentMediaStream = stream;
      
      toast('Using alternative voice recognition method', { icon: '🎙️' });
      
      // Create a MediaRecorder instance with proper mime type
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      const audioChunks = [];
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Create a promise to handle recording completion
      const recordingPromise = new Promise((resolve, reject) => {
        mediaRecorder.onstop = async () => {
          try {
            // Create a blob from the audio chunks
            const audioBlob = new Blob(audioChunks, { 
              type: mediaRecorder.mimeType || 'audio/webm;codecs=opus'
            });
            
            resolve(audioBlob);
          } catch (error) {
            reject(error);
          }
        };
        
        mediaRecorder.onerror = (event) => {
          reject(new Error('MediaRecorder error: ' + event.error));
        };
      });
      
      // Start recording for 5 seconds
      mediaRecorder.start(100); // Collect data every 100ms for smoother chunks
      toast('Recording for 5 seconds...', { icon: '📝' });
      
      // Set a timeout to stop recording after 5 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);
      
      // Wait for the recording to complete
      const audioBlob = await recordingPromise;
      
      // Create a form data object
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');
      
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      
      // Send to the backend for transcription
      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.text) {
        setLocalInputMessage(data.text);
        setInputMessage(data.text);
        console.log('Transcription from backend:', data.text);
      } else {
        throw new Error('No transcription returned from the server');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error(`Transcription failed: ${error.message}`);
    } finally {
      // Clean up resources
      if (window.currentMediaStream) {
        window.currentMediaStream.getTracks().forEach(track => track.stop());
        window.currentMediaStream = null;
      }
      setIsListening(false);
    }
  };

  const MessageBubble = ({ message }) => {
    // Ensure message has all required properties with defaults
    const safeMessage = {
      role: message?.role || 'assistant',
      content: message?.content || '',
      ...message
    };
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex ${safeMessage.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {safeMessage.role !== 'user' && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm mr-2 shadow-glow">
            <SparklesIcon className="w-5 h-5" />
          </div>
        )}
        
        <div 
          className={`max-w-[75%] p-3 rounded-lg ${
            safeMessage.role === 'user' 
              ? 'bg-primary/20 text-white' 
              : 'bg-background-lighter text-gray-100'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap">
            {safeMessage.content || (isLoading ? '...' : '')}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat session selector */}
      <div className="p-3 border-b border-background-lighter flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-300">Chat Session</h3>
        <button
          onClick={handleCreateNewSession}
          className="p-1 rounded-full hover:bg-background-lighter text-gray-400 hover:text-gray-300"
          title="New chat session"
          disabled={isLoadingSessions}
        >
          {isLoadingSessions ? (
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
          ) : (
            <PlusIcon className="w-5 h-5" />
          )}
        </button>
      </div>
      
      {/* Chat messages container with fixed height and auto scroll */}
      <div 
        className="flex-grow overflow-y-auto p-4 flex flex-col" 
        ref={chatContainerRef}
        style={{ maxHeight: 'calc(100vh - 180px)' }}
      >
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400 min-h-[300px]"
            >
              <SparklesIcon className="w-12 h-12 mb-3 text-primary" />
              <h3 className="text-xl font-medium mb-2 text-gray-300">How can I help you today?</h3>
              <p className="max-w-md">
                Ask me anything about your code, or tell me what you'd like to build!
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col w-full space-y-4">
              {messages
                .filter(message => message !== null && message !== undefined)
                .map((message, index) => (
                  <MessageBubble key={message?.id || `msg-${index}`} message={message} />
                ))
              }
              {/* Add extra space at the bottom to ensure last message is fully visible */}
              <div className="h-4"></div>
            </div>
          )}
          
          {(isLoading || isApiProcessing) && !messages.some(m => m.role === 'assistant' && !m.content) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start mb-4"
            >
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm mr-2 shadow-glow">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div className="max-w-[75%] p-4 rounded-lg bg-background-lighter">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-pulse"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-pulse delay-300"></div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="p-4 border-t border-background-lighter sticky bottom-0 bg-background">
        <div className="relative">
          <textarea
            className="w-full p-3 pr-20 rounded-lg bg-background-lighter border border-background-lighter/50 focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none resize-none"
            rows={2}
            placeholder="Ask a question or give instructions..."
            value={localInputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={isLoading || isApiProcessing}
          />
          <div className="absolute bottom-3 right-3 flex space-x-2">
            <button
              className={`p-2 rounded-full ${isListening ? 'bg-red-500 text-white' : 'bg-background-lighter hover:bg-background-lighter/70 text-gray-400 hover:text-gray-300'}`}
              onClick={toggleVoiceRecognition}
              disabled={isLoading || isApiProcessing}
              title={isListening ? "Stop listening" : "Start voice input"}
            >
              {isListening ? 
                <StopIcon className="w-5 h-5" /> : 
                <MicrophoneIcon className="w-5 h-5" />
              }
            </button>
            
            <button
              className="p-2 rounded-full bg-primary hover:bg-primary-lighter text-white"
              onClick={handleSendMessage}
              disabled={!localInputMessage.trim() || isLoading || isApiProcessing}
              title="Send message"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 