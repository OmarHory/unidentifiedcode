from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os

from app.api import code_chat, voice, diff, ide, logs
from app.core.config import settings
from app.core.logger import logger

app = FastAPI(
    title="SpeakCode API",
    description="Voice-first, LLM-powered pair-programming experience",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(code_chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(diff.router, prefix="/api/diff", tags=["Diff"])
app.include_router(ide.router, prefix="/api/ide", tags=["IDE"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])

# Exception handler middleware
@app.middleware("http")
async def exception_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.exception(f"Request to {request.url} failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to SpeakCode API"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy"}

@app.get("/api/health", tags=["Health"])
async def health_check():
    logger.info("API health check endpoint accessed")
    return {"status": "ok", "message": "SpeakCode API is running"}

if __name__ == "__main__":
    # Ensure projects directory exists
    os.makedirs("projects", exist_ok=True)
    
    logger.info("Starting SpeakCode API server")
    
    # Run the FastAPI app
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 