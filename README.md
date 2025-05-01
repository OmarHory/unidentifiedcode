# SpeakCode

SpeakCode is a voice-first LLM-powered pair programming experience. It allows you to interact with your code using voice commands and receive intelligent suggestions from an AI assistant.

## Project Structure

The project is organized into two main components:

- `backend/`: FastAPI backend for voice transcription, LLM integration, and file operations
- `frontend/`: React/Next.js frontend for the user interface

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js v16+
- OpenAI API key (for LLM and voice services)
- ElevenLabs API key (optional, for enhanced voice services)

### Environment Setup

1. Clone this repository
2. Create a `.env` file in the root directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key (optional)
   ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id (optional)
   ```

### Running the Application

#### Start the Backend

```bash
./start-backend.sh
```

This will:
- Set up a Python virtual environment
- Install backend dependencies
- Start the FastAPI server on port 8000

#### Start the Frontend

```bash
./start-frontend.sh
```

This will:
- Install frontend dependencies
- Start the Next.js development server on port 3000

#### Access the Application

Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Features

- Voice-based code editing and navigation
- AI-powered code suggestions and explanations
- File management (create, edit, delete)
- Real-time voice transcription
- Streaming TTS for AI responses

## Development

For detailed information about development:

- See [backend/README.md](backend/README.md) for backend development
- See [frontend/README.md](frontend/README.md) for frontend development 