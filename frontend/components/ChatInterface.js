import { useState, useRef, useEffect, useCallback } from 'react';
import { MicrophoneIcon, PaperAirplaneIcon, StopIcon, SparklesIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { chatApi, getWebSocketBaseUrl, createReconnectingWebSocket } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function ChatInterface({ projectId, onCodeSuggestion }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId, setSessionId] = useState(null);
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

  // Initialize WebSocket connection and session
  useEffect(() => {
    // Check if we have a session ID in localStorage
    const storedSessionId = localStorage.getItem(`chat_session_${projectId}`);
    let currentSessionId;
    
    if (storedSessionId) {
      currentSessionId = storedSessionId;
      setSessionId(storedSessionId);
      
      // Try to load previous messages
      const loadSession = async () => {
        try {
          const response = await chatApi.getSession(storedSessionId);
          if (response.data && Array.isArray(response.data)) {
            setMessages(response.data);
          }
        } catch (error) {
          console.error('Error loading chat session:', error);
          // Generate a new session ID if we couldn't load the previous one
          currentSessionId = `session_${Date.now()}`;
          setSessionId(currentSessionId);
          localStorage.setItem(`chat_session_${projectId}`, currentSessionId);
        }
      };
      
      loadSession();
    } else {
      // Create new session ID
      currentSessionId = `session_${Date.now()}`;
      setSessionId(currentSessionId);
      localStorage.setItem(`chat_session_${projectId}`, currentSessionId);
    }
    
    // Set up WebSocket connection with the updated URL format
    const wsBaseUrl = getWebSocketBaseUrl();
    const wsUrl = `${wsBaseUrl}/chat/ws/${currentSessionId}`;
    console.log('Connecting to WebSocket URL:', wsUrl);
    
    // Use the enhanced WebSocket with reconnection
    const ws = createReconnectingWebSocket(wsUrl, {
      debug: true,
      maxReconnectAttempts: 10,
      reconnectInterval: 1000,
      onOpen: () => {
        console.log('WebSocket connection established');
        toast.success('Connected to chat server');
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
        toast.error('WebSocket connection error. Attempting to reconnect...');
        // Reset loading state if it's stuck due to an error
        if (isLoading) {
          setTimeout(() => {
            setIsLoading(false);
          }, 3000);
        }
      },
      onClose: (event) => {
        console.log('WebSocket connection closed', event?.code, event?.reason);
        // Reset loading state if it was stuck
        if (isLoading) {
          setTimeout(() => {
            setIsLoading(false);
          }, 3000);
        }
      },
      onReconnect: (attempt) => {
        console.log(`Attempting to reconnect (${attempt})...`);
        toast(`Reconnecting to chat server... (Attempt ${attempt})`);
      },
      onMaxReconnectAttemptsExceeded: () => {
        console.error('Max reconnect attempts exceeded');
        toast.error('Could not reconnect to chat server. Please refresh the page.');
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
      }
    };
  }, [projectId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!localInputMessage.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: localInputMessage,
    };
    
    // Add message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setLocalInputMessage('');
    setInputMessage('');
    
    // Send message via WebSocket if connected
    if (wsRef.current && wsRef.current.getState() === WebSocket.OPEN) {
      try {
        wsRef.current.send({
          message: userMessage,
          project_id: projectId
        });
        setIsLoading(true);
      } catch (error) {
        console.error('Error sending message via WebSocket:', error);
        fallbackToRestApi(userMessage);
      }
    } else {
      // Fallback to REST API if WebSocket is not connected
      fallbackToRestApi(userMessage);
    }
  };
  
  // Fallback to REST API if WebSocket connection fails
  const fallbackToRestApi = async (userMessage) => {
    setIsLoading(true);
    
    try {
      // Prepare chat messages for API
      const chatMessages = [
        ...messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        { role: 'user', content: userMessage.content }
      ];
      
      // Include project context
      const projectContext = {
        project_id: projectId,
        name: 'Current Project'
      };
      
      console.log('Falling back to REST API for chat message');
      
      // Send to API
      const response = await chatApi.sendMessage(chatMessages, sessionId, projectContext);
      
      // Add response to chat
      if (response.data && response.data.message) {
        setMessages(prev => [...prev, response.data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(`Error: ${error.message || 'Failed to send message'}`);
    } finally {
      setIsLoading(false);
    }
  };

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
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {message.role !== 'user' && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm mr-2 shadow-glow">
            <SparklesIcon className="w-5 h-5" />
          </div>
        )}
        
        <div 
          className={`max-w-[75%] p-3 rounded-lg ${
            message.role === 'user' 
              ? 'bg-primary/20 text-white' 
              : 'bg-background-lighter text-gray-100'
          }`}
        >
          <div className="text-sm whitespace-pre-wrap">
            {message.content || (isLoading ? '...' : '')}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-grow overflow-y-auto p-4" ref={chatContainerRef}>
        <AnimatePresence>
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400"
            >
              <SparklesIcon className="w-12 h-12 mb-3 text-primary" />
              <h3 className="text-xl font-medium mb-2 text-gray-300">How can I help you today?</h3>
              <p className="max-w-md">
                Ask me anything about your code, or tell me what you'd like to build!
              </p>
            </motion.div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}
          
          {isLoading && !messages.some(m => m.role === 'assistant' && !m.content) && (
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
      
      <div className="p-4 border-t border-background-lighter">
        <div className="relative">
          <textarea
            className="w-full p-3 pr-20 rounded-lg bg-background-lighter border border-background-lighter/50 focus:border-primary/30 focus:ring-1 focus:ring-primary/20 outline-none resize-none"
            rows={2}
            placeholder="Ask a question or give instructions..."
            value={localInputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          <div className="absolute bottom-3 right-3 flex space-x-2">
            <button
              className={`p-2 rounded-full ${isListening ? 'bg-red-500 text-white' : 'bg-background-lighter hover:bg-background-lighter/70 text-gray-400 hover:text-gray-300'}`}
              onClick={toggleVoiceRecognition}
              disabled={isLoading}
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
              disabled={!localInputMessage.trim() || isLoading}
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