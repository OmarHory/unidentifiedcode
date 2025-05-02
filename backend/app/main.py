from fastapi import FastAPI, HTTPException, Request, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
import uvicorn
import os
import sys
import traceback
from datetime import datetime
import asyncio
from typing import Optional

from app.api import chat, voice, diff, ide, logs, auth
from app.core.config import settings
from app.core.logger import logger
from app.core.middleware import RateLimitMiddleware, AuthMiddleware
from app.api.voice import cleanup_stale_sessions
from app.services.session_service import session_service

app = FastAPI(
    title="SpeakCode API",
    description="Voice-first, LLM-powered pair-programming experience",
    version="0.1.0",
    docs_url=None,  # Disable default docs
    redoc_url=None,  # Disable default redoc
)

# Configure CORS with explicit headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Authorization", "Content-Type"],
    expose_headers=["*"],
)

# Add rate limiting and auth middleware
app.middleware("http")(RateLimitMiddleware())
app.middleware("http")(AuthMiddleware())

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(diff.router, prefix="/api/diff", tags=["Diff"])
app.include_router(ide.router, prefix="/api/ide", tags=["IDE"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logs"])

# Custom exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handler caught: {str(exc)}")
    logger.error(traceback.format_exc())
    
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )

# Custom OpenAPI documentation
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title=f"{settings.APP_NAME} - API Documentation",
        swagger_favicon_url="/favicon.ico"
    )

@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_schema():
    openapi_schema = get_openapi(
        title=settings.APP_NAME,
        version="1.0.0",
        description="Voice-first, LLM-powered pair-programming experience API documentation",
        routes=app.routes,
    )
    return openapi_schema

@app.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Welcome to SpeakCode API"}

@app.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy"}

@app.get("/api/health", tags=["Health"])
async def api_health_check():
    logger.info("API health check endpoint accessed")
    return {
        "status": "ok",
        "message": "SpeakCode API is running",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/debug/auth")
async def debug_auth(request: Request, authorization: Optional[str] = Header(None)):
    """
    Debug endpoint to check authentication headers
    """
    logger.info("Debug auth endpoint accessed")
    
    # Log all headers and request info
    request_info = {
        "headers": dict(request.headers),
        "url": str(request.url),
        "method": request.method,
        "client": request.client and request.client.host,
        "authorization": authorization,
    }
    
    # Try to get user from request state (set by auth middleware)
    user = getattr(request.state, "user", None)
    
    # Log request info
    logger.info(f"Debug auth request: {request_info}")
    
    return {
        "status": "ok",
        "message": "Auth debug information",
        "request_info": request_info,
        "auth_status": "authenticated" if user else "not authenticated",
        "user": user,
        "timestamp": datetime.utcnow().isoformat()
    }

# Background tasks
@app.on_event("startup")
async def startup_event():
    # Start background tasks
    asyncio.create_task(cleanup_stale_sessions())
    logger.info("Started background tasks")

@app.on_event("shutdown")
async def shutdown_event():
    # Cleanup resources
    logger.info("Shutting down application")

if __name__ == "__main__":
    # Run the FastAPI app
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    ) 