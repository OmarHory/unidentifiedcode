# API Usage Documentation

This document outlines the various APIs used throughout the frontend application and their integration points.

## Core API Structure

The application's API is organized into several modules, all centralized in `lib/api.js`:

### Authentication API (`authApi`)
- **Login**: `authApi.login(username, password)`
  - Used in: `LoginForm` component
- **Token Management**:
  - `setToken(token)`: Stores auth token in localStorage
  - `removeToken()`: Removes token from localStorage
  - `getToken()`: Retrieves stored token

### Projects API (`projectsApi`)
- **Project Operations**:
  - `create(name, metadata)`: Create new project
  - `get(projectId)`: Get project details
  - `listFiles(projectId, path)`: List project files
  - `getFile(projectId, filePath)`: Get file contents
  - `updateFile(projectId, filePath, content)`: Update file contents
  - `deleteFile(projectId, filePath)`: Delete file
  - `fileOperation(projectId, operation)`: Perform file operations

### Chat API (`chatApi`)
- **Chat Operations**:
  - `sendMessage(messages, sessionId, projectContext)`: Send chat message
  - `getSession(sessionId)`: Get chat session
  - `deleteSession(sessionId)`: Delete chat session
- Used in: `ChatInterface` component
  - Implements both REST and WebSocket-based communication
  - WebSocket URL format: `{wsBaseUrl}/chat/ws/{sessionId}`

### Voice API (`voiceApi`)
- **Speech-to-Text**:
  - `transcribe(audioFile)`: Transcribe audio file
  - `transcribeBase64(audioData)`: Transcribe base64 audio data
  - `streamAudioChunk(audioChunk, sessionId)`: Stream audio for transcription
- **Text-to-Speech**:
  - `textToSpeech(text, voice)`: Convert text to speech
  - `elevenLabsTextToSpeech(text, voice)`: ElevenLabs TTS
- **Phone Call**:
  - `startPhoneCall(projectId)`: Start LLM phone call
  - `endPhoneCall(callId)`: End phone call
- Used in: `VoiceChat` component and `ChatInterface` voice recognition

### Diff API (`diffApi`)
- **Diff Operations**:
  - `generate(projectId, filePath, modifiedContent)`: Generate diff
  - `apply(projectId, filePath, diffOperations)`: Apply diff
  - `analyze(projectId, filePath, originalContent, modifiedContent)`: Analyze diff
  - `parse(diffText)`: Parse diff text
- Used in: Code editing and version control features

## WebSocket Implementation

The application implements a robust WebSocket connection system using `createReconnectingWebSocket`:

- **Features**:
  - Automatic reconnection with exponential backoff
  - Configurable max reconnection attempts
  - Event handlers for connection lifecycle
  - Debug logging capabilities

## API Configuration

- Base URL: Relative `/api` path for local development
- Timeout: 30 seconds default, 45 seconds for file operations
- Authentication: Bearer token via Authorization header
- Content Types: 
  - JSON for most requests
  - Multipart/form-data for file uploads
  - WebSocket for real-time communication

## Error Handling

- Comprehensive error logging for API requests
- Fallback mechanisms for WebSocket failures
- Toast notifications for connection status
- Automatic token refresh handling

## API Specifications

### Authentication API

#### POST /api/auth/token
- **Purpose**: User authentication
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "string",
    "user": {
      "id": "string",
      "username": "string"
    }
  }
  ```

### Projects API

#### POST /api/ide/projects
- **Purpose**: Create new project
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "name": "string",
    "metadata": {
      "description": "string",
      "type": "string"
    }
  }
  ```
- **Response**: Project object

#### GET /api/ide/projects/{projectId}
- **Purpose**: Get project details
- **Headers**: Authorization: Bearer {token}
- **Response**: Project object

#### GET /api/ide/projects/{projectId}/files
- **Purpose**: List project files
- **Headers**: Authorization: Bearer {token}
- **Query Parameters**: path (optional)
- **Response**: Array of file objects

#### POST /api/ide/projects/{projectId}/files
- **Purpose**: File operations (create/update/delete)
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "operation": "create|update|delete",
    "path": "string",
    "content": "string" // Optional, for create/update
  }
  ```
- **Response**: Operation result

### Chat API

#### POST /api/chat/completions
- **Purpose**: Send chat message
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "messages": [{
      "role": "user|assistant",
      "content": "string"
    }],
    "session_id": "string",
    "project_context": {
      "project_id": "string",
      "file_path": "string" // Optional
    }
  }
  ```
- **Response**: Chat completion

#### WebSocket /api/chat/ws/{sessionId}
- **Purpose**: Real-time chat communication
- **Headers**: Authorization: Bearer {token}
- **Messages**:
  ```json
  // Server -> Client (stream_start)
  {
    "type": "stream_start",
    "message": {
      "id": "string",
      "role": "assistant",
      "content": null
    }
  }

  // Server -> Client (stream_chunk)
  {
    "type": "stream_chunk",
    "message_id": "string",
    "chunk": "string"
  }

  // Client -> Server
  {
    "type": "message",
    "content": "string",
    "project_context": {
      "project_id": "string",
      "file_path": "string" // Optional
    }
  }
  ```

### Voice API

#### POST /api/voice/transcribe
- **Purpose**: Transcribe audio file
- **Headers**: Authorization: Bearer {token}
- **Content-Type**: multipart/form-data
- **Request Body**: Form data with 'audio_file'
- **Response**:
  ```json
  {
    "text": "string",
    "confidence": number
  }
  ```

#### POST /api/voice/text-to-speech
- **Purpose**: Convert text to speech
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "text": "string",
    "voice": "string" // Optional, defaults to 'alloy'
  }
  ```
- **Response**: Audio file stream

#### POST /api/voice/elevenlabs/text-to-speech
- **Purpose**: ElevenLabs TTS
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "text": "string",
    "voice": "string" // Optional, defaults to 'Rachel'
  }
  ```
- **Response**: Audio file stream

### Diff API

#### POST /api/diff/generate
- **Purpose**: Generate diff between versions
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "project_id": "string",
    "file_path": "string",
    "modified_content": "string"
  }
  ```
- **Response**: Diff object

#### POST /api/diff/apply
- **Purpose**: Apply diff operations
- **Headers**: Authorization: Bearer {token}
- **Request Body**:
  ```json
  {
    "project_id": "string",
    "file_path": "string",
    "diff_operations": [{
      "type": "add|remove|replace",
      "start": number,
      "end": number,
      "content": "string"
    }]
  }
  ```
- **Response**: Updated file content
