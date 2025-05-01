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
      maxReconnectAttempts: 5,
      reconnectInterval: 1000,
      onOpen: () => {
        console.log('WebSocket connection established');
        toast.success('Connected to chat server');
      },
      onMessage: (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        if (data.type === 'stream_start') {
          // Add an empty message that will be filled in with chunks
          setMessages(prev => [...prev, data.message]);
          setIsLoading(true);
        }
        else if (data.type === 'stream_chunk') {
          // Update the message with the new chunk
          setMessages(prev => prev.map(msg => 
            msg.id === data.message_id 
              ? { ...msg, content: msg.content + data.chunk }
              : msg
          ));
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
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection error. Attempting to reconnect...');
      },
      onClose: () => {
        console.log('WebSocket connection closed');
      },
      onReconnect: (attempt) => {
        console.log(`Attempting to reconnect (${attempt})...`);
        toast(`Reconnecting to chat server... (Attempt ${attempt})`);
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        message: userMessage,
        project_id: projectId
      }));
    } else {
      // Fallback to REST API if WebSocket is not connected
      setIsLoading(true);
      
      try {
        // Prepare chat messages for API
        const chatMessages = [
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          { role: 'user', content: localInputMessage }
        ];
        
        // Include project context
        const projectContext = {
          project_id: projectId,
          name: 'Current Project'
        };
        
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
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceRecognition = () => {
    if (isListening) {
      // Stop listening
      setIsListening(false);
      toast('Voice recognition stopped', { icon: '🔇' });
    } else {
      // Start listening
      setIsListening(true);
      toast('Listening... Speak now', { icon: '🎤' });
      
      // Simulate voice recognition - replace with actual implementation
      setTimeout(() => {
        setInputMessage(prev => prev + ' Voice recognition sample text');
        setIsListening(false);
      }, 3000);
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