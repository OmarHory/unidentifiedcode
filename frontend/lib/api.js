import axios from 'axios';

// Use relative API paths for local development to avoid CORS issues
const API_URL = '/api';

// Get the WebSocket base URL for the current environment
export const getWebSocketBaseUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // Log the WebSocket base URL for debugging
  const wsBaseUrl = `${protocol}//${host}/api`;
  console.log(`WebSocket base URL: ${wsBaseUrl}`);
  
  return wsBaseUrl;
};

// Helper function to create a WebSocket with automatic reconnection
export const createReconnectingWebSocket = (url, options = {}) => {
  const {
    maxReconnectAttempts = 5,
    reconnectInterval = 1000,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onMaxReconnectAttemptsExceeded,
    debug = false
  } = options;
  
  let ws = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  
  const log = (...args) => {
    if (debug) console.log(...args);
  };
  
  const connect = () => {
    // Clear any pending reconnect timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // Close existing connection if any
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        log('Error closing previous WebSocket:', e);
      }
    }
    
    log(`Connecting to WebSocket: ${url}`);
    ws = new WebSocket(url);
    
    ws.onopen = (event) => {
      log('WebSocket connection established');
      reconnectAttempts = 0;
      if (onOpen) onOpen(event);
    };
    
    ws.onmessage = (event) => {
      if (onMessage) onMessage(event);
    };
    
    ws.onerror = (event) => {
      log('WebSocket error:', event);
      if (onError) onError(event);
    };
    
    ws.onclose = (event) => {
      log(`WebSocket closed (code: ${event.code}):`, event.reason);
      
      if (onClose) onClose(event);
      
      // Don't reconnect if it was a normal closure or max attempts reached
      if (event.code === 1000 || event.code === 1001) {
        log('Clean closure, not reconnecting');
        return;
      }
      
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = reconnectInterval * Math.pow(1.5, reconnectAttempts);
        log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        
        reconnectAttempts++;
        reconnectTimer = setTimeout(() => {
          if (onReconnect) onReconnect(reconnectAttempts);
          connect();
        }, delay);
      } else {
        log(`Max reconnect attempts (${maxReconnectAttempts}) reached`);
        if (onMaxReconnectAttemptsExceeded) onMaxReconnectAttemptsExceeded();
      }
    };
  };
  
  const api = {
    connect,
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (typeof data === 'object') {
          ws.send(JSON.stringify(data));
        } else {
          ws.send(data);
        }
        return true;
      }
      return false;
    },
    close: (code, reason) => {
      if (ws) {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        ws.close(code, reason);
      }
    },
    getState: () => ws ? ws.readyState : WebSocket.CLOSED
  };
  
  // Initial connection
  connect();
  
  return api;
};

// Create our axios instance first
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests if needed
  timeout: 30000, // Increased timeout from 10000ms to 30000ms (30 seconds)
});

// Auth API - putting this after api creation
export const authApi = {
  login: (username, password) => 
    api.post('/auth/token', { username, password }),
  
  // Store token in localStorage
  setToken: (token) => {
    localStorage.setItem('auth_token', token);
    // Update axios default headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Token set:', token.substring(0, 15) + '...');
    console.log('Headers updated:', api.defaults.headers.common['Authorization']);
  },
  
  // Remove token from localStorage
  removeToken: () => {
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
    console.log('Token removed');
  },
  
  // Get stored token
  getToken: () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      console.log('Token retrieved from storage:', token.substring(0, 15) + '...');
    }
    return token;
  }
};

// Initialize auth token from localStorage (if browser environment)
if (typeof window !== 'undefined') {
  const token = authApi.getToken();
  if (token) {
    console.log('Initializing API with token from localStorage');
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    console.log('No token found in localStorage during initialization');
  }
}

// Add auth token to requests if available
api.interceptors.request.use(
  request => {
    const token = authApi.getToken();
    if (token) {
      request.headers['Authorization'] = `Bearer ${token}`;
      console.log(`Request to ${request.url} includes auth token`);
    } else {
      console.log(`Request to ${request.url} has no auth token`);
    }
    return request;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  error => {
    // More detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        url: error.config?.url
      });
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error Request:', {
        request: error.request,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // Check if it's a timeout error
      if (error.code === 'ECONNABORTED') {
        console.error('Request timeout. The server took too long to respond.');
        error.isTimeout = true;
        error.customMessage = 'The request timed out. The server might be starting up or under heavy load. Please try again in a moment.';
      }
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error Setup:', error.message, error.config?.url);
    }
    
    return Promise.reject(error);
  }
);

// Projects API with improved error handling
export const projectsApi = {
  create: (name, metadata = {}) => {
    console.log(`Creating project: ${name}`);
    return api.post('/ide/projects', { 
      name, 
      description: metadata.description || '', 
      technology: metadata.technology || '',
      meta_data: metadata  // Include the full metadata object as meta_data
    }, {
      timeout: 60000 // 60 seconds timeout for project creation specifically
    });
  },
  get: (projectId) => api.get(`/ide/projects/${projectId}`),
  listFiles: (projectId, path = '/') => api.get(`/ide/projects/${projectId}/files`, { params: { path } }),
  getFile: (projectId, filePath) => api.get(`/ide/projects/${projectId}/files/${encodeURIComponent(filePath)}`),
  updateFile: (projectId, filePath, content) => api.put(`/ide/projects/${projectId}/files/${encodeURIComponent(filePath)}`, { content }),
  deleteFile: (projectId, filePath) => api.delete(`/ide/projects/${projectId}/files/${encodeURIComponent(filePath)}`),
  fileOperation: (projectId, operation) => {
    // Enhanced logging for file operations
    console.log('File operation request:', { 
      projectId, 
      operation: operation.operation,
      path: operation.path,
      contentLength: operation.content ? operation.content.length : 0
    });
    
    // Format the request payload correctly
    const payload = {
      operation: operation.operation,
      path: operation.path,
    };
    
    // Only include content for operations that need it
    if (operation.operation === 'create' || operation.operation === 'update') {
      payload.content = operation.content || '';
    }
    
    // Make the API call with detailed request
    console.log(`Calling API: POST /ide/projects/${projectId}/files with payload:`, payload);
    
    // Ensure path is properly normalized
    if (payload.path) {
      payload.path = payload.path.startsWith('/') ? payload.path : '/' + payload.path;
    }
    
    return api.post(`/ide/projects/${projectId}/files`, payload, {
      // Longer timeout for file operations that might involve larger files
      timeout: 45000, // 45 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(response => {
        console.log('File operation success:', response.data);
        return response;
      })
      .catch(error => {
        console.error('File operation failed:', error);
        // Log more detailed error information
        if (error.response) {
          console.error('Server response:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          });
        }
        throw error;
      });
  },
};

// Chat API
export const chatApi = {
  // Session management
  createSession: (projectId, name) => 
    api.post('/chat/sessions', { project_id: projectId, name }),
  listSessions: (projectId) => 
    api.get('/chat/sessions', { params: projectId ? { project_id: projectId } : {} }),
  getSession: (sessionId) => 
    api.get(`/chat/sessions/${sessionId}`),
  deleteSession: (sessionId) => 
    api.delete(`/chat/sessions/${sessionId}`),
    
  // Chat messages
  sendMessage: (messages, sessionId, projectContext) => 
    api.post('/chat/completions', { messages, session_id: sessionId, project_context: projectContext }),
};

// Voice API
export const voiceApi = {
  transcribe: (audioFile) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    return api.post('/voice/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  transcribeBase64: (audioData) => api.post('/voice/transcribe-base64', { audio_file: audioData }),
  textToSpeech: (text, voice = 'alloy') => api.post('/voice/text-to-speech', { text, voice }),
  
  // ElevenLabs ASR API
  elevenLabsTranscribe: (audioFile) => {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    return api.post('/voice/elevenlabs/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // ElevenLabs TTS streaming API
  elevenLabsTextToSpeech: (text, voice = 'Rachel') => 
    api.post('/voice/elevenlabs/text-to-speech', { text, voice }),
    
  // Streaming ASR audio chunk
  streamAudioChunk: (audioChunk, sessionId) => {
    const formData = new FormData();
    formData.append('audio_chunk', audioChunk);
    formData.append('session_id', sessionId);
    return api.post('/voice/elevenlabs/stream-chunk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Start a phone call with LLM
  startPhoneCall: (projectId) => 
    api.post('/voice/phone-call/start', { project_id: projectId }),
    
  // End a phone call with LLM
  endPhoneCall: (callId) => 
    api.post(`/voice/phone-call/end/${callId}`),
};

// Diff API
export const diffApi = {
  generate: (projectId, filePath, modifiedContent) => 
    api.post(`/diff/generate`, {
      project_id: projectId,
      file_path: filePath,
      modified_content: modifiedContent
    }),
  apply: (projectId, filePath, diffOperations) => 
    api.post(`/diff/apply`, {
      project_id: projectId,
      file_path: filePath,
      diff_operations: diffOperations
    }),
  analyze: (projectId, filePath, originalContent, modifiedContent) => 
    api.post(`/diff/analyze`, {
      project_id: projectId,
      file_path: filePath,
      original_content: originalContent,
      modified_content: modifiedContent
    }),
  parse: (diffText) => api.post('/diff/parse', { diff_text: diffText }),
};

export default api; 