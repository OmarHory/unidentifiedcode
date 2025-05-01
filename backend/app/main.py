from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import sys
import traceback
from datetime import datetime
import asyncio

from app.api import code_chat, voice, diff, ide, logs
from app.core.config import settings
from app.core.logger import logger
from app.api.voice import cleanup_stale_sessions

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
    request_id = f"{datetime.now().strftime('%Y%m%d%H%M%S')}-{id(request)}"
    request_path = f"{request.method} {request.url.path}"
    
    # Log request
    logger.info(f"Request started: {request_id} - {request_path}")
    
    start_time = datetime.now()
    
    try:
        response = await call_next(request)
        
        # Log successful response
        process_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.info(f"Request completed: {request_id} - {request_path} - Status: {response.status_code} - Duration: {process_time:.2f}ms")
        
        return response
    except HTTPException as e:
        # Handle HTTP exceptions (these are expected errors like 404, 400, etc.)
        logger.warning(f"HTTP Exception in {request_path}: {e.status_code} - {e.detail}")
        process_time = (datetime.now() - start_time).total_seconds() * 1000
        logger.info(f"Request failed: {request_id} - {request_path} - Status: {e.status_code} - Duration: {process_time:.2f}ms")
        
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail}
        )
    except Exception as e:
        # Handle unexpected exceptions
        process_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Get full exception details with traceback
        exc_info = sys.exc_info()
        exception_details = "".join(traceback.format_exception(*exc_info))
        
        # Log detailed error information
        logger.exception(
            f"Unhandled exception in {request_path} [{request_id}]: {str(e)}\n"
            f"Exception details: {exception_details}"
        )
        
        # Log request failure summary
        logger.error(f"Request failed: {request_id} - {request_path} - Status: 500 - Duration: {process_time:.2f}ms")
        
        error_message = str(e) if settings.DEBUG else "Internal Server Error"
        
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": error_message,
                "request_id": request_id  # Include request ID for troubleshooting
            }
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

# Startup event handler
@app.on_event("startup")
async def startup_event():
    """
    Initialize resources on application startup
    """
    logger.info("Starting SpeakCode API server")
    
    # Ensure projects directory exists
    try:
        os.makedirs("projects", exist_ok=True)
        logger.info("Projects directory ensured")
    except Exception as e:
        logger.exception(f"Failed to create projects directory: {str(e)}")
        # This is critical enough to re-raise
        raise

    # Ensure logs directory exists
    try:
        os.makedirs("logs", exist_ok=True)
        logger.info("Logs directory ensured")
    except Exception as e:
        logger.exception(f"Failed to create logs directory: {str(e)}")
    
    # Log configuration information
    logger.info(f"Running with configuration: DEBUG={settings.DEBUG}")
    logger.info(f"CORS origins configured: {settings.CORS_ORIGINS}")
    
    if not settings.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set - OpenAI functionality will not work")
    
    # Start voice service session cleanup task
    voice.cleanup_task = asyncio.create_task(cleanup_stale_sessions())
    logger.info("Voice service session cleanup task started")

# Shutdown event handler
@app.on_event("shutdown")
async def shutdown_event():
    """
    Clean up resources on application shutdown
    """
    logger.info("Shutting down SpeakCode API server")
    
    # Cancel voice service cleanup task if running
    if voice.cleanup_task and not voice.cleanup_task.done():
        voice.cleanup_task.cancel()
        try:
            await voice.cleanup_task
        except asyncio.CancelledError:
            pass
        logger.info("Voice service session cleanup task stopped")
    
    # Clean up any remaining ASR sessions
    for session_id, session in list(voice.asr_sessions.items()):
        try:
            websocket = session["websocket"]
            await websocket.close(code=1000, reason="Server shutdown")
        except:
            pass
        
    # Clear all sessions
    voice.asr_sessions.clear()
    logger.info("All voice sessions cleaned up")

if __name__ == "__main__":
    # Run the FastAPI app
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 