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

  // When current project changes, load or create a chat session for that project
  useEffect(() => {
    if (isAuthenticated() && currentProject) {
      // Try to get the last used session ID for this project from localStorage
      const projectSessionKey = `project_${currentProject.id}_session`;
      const storedSessionId = localStorage.getItem(projectSessionKey);
      
      if (storedSessionId) {
        // If we have a stored session ID for this project, try to load it
        setSessionId(storedSessionId);
        loadChatSession(storedSessionId);
      } else {
        // No stored session for this project, create a new one
        createChatSession(currentProject.id);
      }
    } else {
      // No authentication or no project selected
      setSessionId(null);
      setMessages([]);
    }
  }, [isAuthenticated, currentProject]);

  // Create a new chat session for a project
  async function createChatSession(projectId, name = 'New Chat') {
    if (!projectId) return;
    
    try {
      const response = await chatApi.createSession(projectId, name);
      const newSessionId = response.data.id;
      
      // Store the session ID for this project
      const projectSessionKey = `project_${projectId}_session`;
      localStorage.setItem(projectSessionKey, newSessionId);
      
      setSessionId(newSessionId);
      setMessages([]);
      
      return newSessionId;
    } catch (err) {
      console.error('Error creating chat session:', err);
      setError(err.message || 'Failed to create chat session');
    }
  }
  
  // Load chat messages when session ID changes
  async function loadChatSession(sid) {
    if (!sid) return;
    
    try {
      const response = await chatApi.getSession(sid);
      
      // The API now returns a structured response with messages array
      if (response.data && response.data.messages) {
        setMessages(response.data.messages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Error loading chat session:', err);
      
      // If session not found and we have a current project, create a new one
      if (err.response && err.response.status === 404 && currentProject) {
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
      
      // Send message to API
      const response = await chatApi.sendMessage([...messages, userMessage], sessionId, projectContext);
      
      // Add assistant's response to messages
      setMessages((prev) => [...prev, response.data.message]);
      
      return response.data.message;
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
      } catch (err) {
        console.error('Error deleting chat session:', err);
      }
    }
    
    // Create a new session if we have a current project
    if (currentProject) {
      createChatSession(currentProject.id);
    } else {
      setSessionId(null);
      setMessages([]);
    }
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        sessionId,
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
        loadChatSession
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