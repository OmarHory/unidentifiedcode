# SpeakCode Backend

This is the backend for the SpeakCode application. It's built with FastAPI and provides various APIs for voice transcription, LLM chat, code diff generation, and project/file management.

## Directory Structure

- `app/`: Main application code
  - `api/`: API routes
  - `core/`: Core application configuration
  - `models/`: Pydantic models
  - `services/`: Business logic services
- `tests/`: Unit and integration tests

## Getting Started

1. Make sure you have Python 3.9+ installed

2. Set up your environment variables in `.env` file:
   ```
   OPENAI_API_KEY=your_openai_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key (optional)
   ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id (optional)
   ```

3. Run the application:
   ```
   ./run.sh
   ```

This will:
- Create a virtual environment if it doesn't exist
- Install dependencies
- Start the FastAPI server

## API Endpoints

- `/api/voice/`: Voice transcription and text-to-speech
- `/api/chat/`: LLM chat completion
- `/api/diff/`: Code diff generation
- `/api/ide/`: Project and file management

## Running Tests

```
pytest tests/
``` 