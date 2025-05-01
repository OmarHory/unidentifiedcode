import os
from typing import List

from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "SpeakCode"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",  # React development server
        "http://localhost:3001",  # Alternative React development server
        "http://localhost:8000",  # FastAPI server
        "https://localhost",
        "https://localhost:3000",
        "https://localhost:3001", 
        "https://localhost:8000",
        "https://*.herokuapp.com",  # Heroku domains
        "*"  # Allow all origins in development (remove in production)
    ]
    CORS_ALLOW_METHODS: List[str] = ["*"]  # Allow all methods
    CORS_ALLOW_HEADERS: List[str] = ["*"]  # Allow all headers
    
    # LLM settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4-turbo")
    
    # ElevenLabs settings
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
    ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "Rachel")

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./speakcode.db"
    )
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "speakcodesecretkey")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    class Config:
        env_file = ".env"
        case_sensitive = True

# Create settings instance
settings = Settings() 