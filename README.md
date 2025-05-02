# SpeakCode API

Voice-first, LLM-powered pair-programming experience.

## Features

- Voice transcription using OpenAI Whisper
- LLM-powered code assistance
- Real-time chat with context awareness
- File management and code diff generation
- Session management with Redis
- Rate limiting and authentication
- Comprehensive API documentation

## Prerequisites

- Python 3.8+
- Redis server
- OpenAI API key
- ElevenLabs API key (optional, for voice synthesis)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/speakcode.git
cd speakcode
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r backend/requirements.txt
```

4. Create a `.env` file in the backend directory:
```env
# Application settings
DEBUG=True
SECRET_KEY=your-secret-key

# API Keys
OPENAI_API_KEY=your-openai-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
ELEVENLABS_VOICE_ID=your-voice-id

# Redis settings
REDIS_HOST=localhost
REDIS_PORT=6379

# Database settings
DATABASE_URL=sqlite:///./speakcode.db
```

5. Start Redis server:
```bash
redis-server
```

6. Run the application:
```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Authentication

The API uses JWT-based authentication. To access protected endpoints:

1. Get a JWT token by making a POST request to `/api/auth/token`
2. Include the token in the Authorization header:
```
Authorization: Bearer your-jwt-token
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- 100 requests per minute per IP address
- Applies to all endpoints except health checks
- Returns 429 Too Many Requests when limit is exceeded

## Caching

Response caching is implemented for:
- Chat completions
- File contents
- Project metadata

Cache TTL is configurable in the settings.

## Development

### Code Style

The project uses:
- Black for code formatting
- isort for import sorting
- flake8 for linting
- mypy for type checking

Run formatters:
```bash
black backend/
isort backend/
```

Run linters:
```bash
flake8 backend/
mypy backend/
```

### Testing

Run tests:
```bash
pytest backend/tests/
```

With coverage:
```bash
pytest --cov=backend backend/tests/
```

## License

MIT License - see LICENSE file for details 