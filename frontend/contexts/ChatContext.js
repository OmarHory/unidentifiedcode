import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatApi, voiceApi } from '../lib/api';
import { useProject } from './ProjectContext';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const { currentProject } = useProject();

  const { isAuthenticated } = useAuth();

  // State to store all chat sessions for the current project
  const [chatSessions, setChatSessions] = useState([]);
  const [currentChatSession, setCurrentChatSession] = useState(null);
  
  // When current project changes, load chat sessions for that project
  useEffect(() => {
    if (isAuthenticated() && currentProject) {
      // Load all chat sessions for this project
      loadChatSessions(currentProject.id);
    } else {
      // No authentication or no project selected
      setSessionId(null);
      setMessages([]);
      setChatSessions([]);
      setCurrentChatSession(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]); // Removed isAuthenticated and loadChatSessions from deps to prevent infinite calls
  
  // Load all chat sessions for a project
  async function loadChatSessions(projectId) {
    if (!projectId || !isAuthenticated()) return;
    
    try {
      const response = await chatApi.listSessions(projectId);
      let sessions = [];
      
      // Handle different response formats
      if (response.data) {
        if (Array.isArray(response.data)) {
          // Direct array of sessions
          sessions = response.data;
        } else if (response.data.sessions && Array.isArray(response.data.sessions)) {
          // Object with sessions property
          sessions = response.data.sessions;
        }
      }
      
      setChatSessions(sessions);
      
      // If there are sessions, load the most recent one
      if (sessions.length > 0) {
        // Sort sessions by created_at (newest first)
        const sortedSessions = [...sessions].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        
        const mostRecentSession = sortedSessions[0];
        setCurrentChatSession(mostRecentSession);
        setSessionId(mostRecentSession.id);
        loadChatSession(mostRecentSession.id);
      } else {
        // No sessions found, create a new one
        createChatSession(projectId);
      }
    } catch (err) {
      console.error('Error loading chat sessions:', err);
      setError(err.message || 'Failed to load chat sessions');
      
      // If there's an error, create a new session
      createChatSession(projectId);
    }
  }

  // Create a new chat session for a project
  async function createChatSession(projectId, name = 'New Chat') {
    if (!projectId) return;
    
    try {
      const response = await chatApi.createSession(projectId, name);
      const newSession = response.data;
      
      // Update state with the new session
      setSessionId(newSession.id);
      setCurrentChatSession(newSession);
      setChatSessions(prev => [newSession, ...prev]);
      setMessages([]);
      
      return newSession.id;
    } catch (err) {
      console.error('Error creating chat session:', err);
      setError(err.message || 'Failed to create chat session');
    }
  }
  
  // Load chat messages for a specific session
  async function loadChatSession(sid) {
    if (!sid) return;
    
    try {
      const response = await chatApi.getSession(sid);
      
      // Update current session
      if (response.data) {
        setCurrentChatSession(response.data);
        
        // The API returns a structured response with messages array
        if (response.data.messages) {
          setMessages(response.data.messages);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error loading chat session:', err);
      
      // If session not found and we have a current project, create a new one
      if (err.response && err.response.status === 404 && currentProject) {
        // Remove the invalid session from our list
        setChatSessions(prev => prev.filter(session => session.id !== sid));
        // Create a new session
        createChatSession(currentProject.id);
      } else {
        setError(err.message || 'Failed to load chat session');
      }
    }
  }

  async function sendMessage(content) {
    setIsProcessing(true);
    setError(null);
    
    try {
      const userMessage = {
        id: uuidv4(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      
      // Update messages locally first for immediate UI feedback
      setMessages((prev) => [...prev, userMessage]);
      
      // Prepare project context if needed
      const projectContext = currentProject ? { project_id: currentProject.id } : null;
      
      // Check if WebSocket is connected in ChatInterface component
      // The actual message sending is now handled by the WebSocket in ChatInterface
      // This function now only updates the local state
      
      return userMessage;
    } catch (err) {
      setError(err.message || 'Error sending message');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err.message || 'Error accessing microphone');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob) {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await voiceApi.transcribe(audioBlob);
      setTranscript(response.data.text);
      // Automatically send the transcribed text as a message
      await sendMessage(response.data.text);
      return response.data.text;
    } catch (err) {
      setError(err.message || 'Error transcribing audio');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function textToSpeech(text, voice = 'alloy') {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await voiceApi.textToSpeech(text, voice);
      // Play the audio
      const audio = new Audio(`data:audio/mp3;base64,${response.data.audio_data}`);
      audio.play();
    } catch (err) {
      setError(err.message || 'Error converting text to speech');
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }

  async function clearChat() {
    if (sessionId) {
      try {
        await chatApi.deleteSession(sessionId);
        
        // Remove the deleted session from our list
        setChatSessions(prev => prev.filter(session => session.id !== sessionId));
      } catch (err) {
        console.error('Error deleting chat session:', err);
      }
    }
    
    // Create a new session if we have a current project
    if (currentProject) {
      createChatSession(currentProject.id);
    } else {
      setSessionId(null);
      setCurrentChatSession(null);
      setMessages([]);
    }
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        sessionId,
        chatSessions,
        currentChatSession,
        isRecording,
        transcript,
        isProcessing,
        error,
        sendMessage,
        startRecording,
        stopRecording,
        transcribeAudio,
        textToSpeech,
        clearChat,
        createChatSession,
        loadChatSession,
        loadChatSessions,
        setSessionId,
        setCurrentChatSession
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

export default ChatContext; 