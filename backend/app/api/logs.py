from fastapi import APIRouter, Body
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.core.logger import logger

router = APIRouter()

class LogEntry(BaseModel):
    level: str
    message: str
    details: Optional[Dict[str, Any]] = {}
    timestamp: Optional[str] = None
    userAgent: Optional[str] = None
    url: Optional[str] = None

@router.post("/")
async def log_entry(entry: LogEntry = Body(...)):
    """
    Endpoint to receive logs from frontend
    """
    # Map frontend log levels to Python logging levels
    log_method = {
        'debug': logger.debug,
        'info': logger.info,
        'warn': logger.warning,
        'error': logger.error,
    }.get(entry.level.lower(), logger.info)
    
    # Format the log entry
    log_message = f"[FRONTEND] {entry.message}"
    
    # Include additional context in extra dict
    extra = {
        "frontend_details": entry.details,
        "user_agent": entry.userAgent,
        "page_url": entry.url,
        "frontend_timestamp": entry.timestamp
    }
    
    # Log the message
    log_method(log_message, extra=extra)
    
    return {"status": "success"}

@router.get("/test-error")
async def test_error():
    """
    Test endpoint that throws an exception
    """
    logger.info("About to throw a test exception")
    # Deliberately throw an exception
    raise ValueError("This is a test exception")
    return {"status": "This should never be returned"} 