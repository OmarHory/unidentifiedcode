#!/usr/bin/env python3

import uvicorn
import os
import sys
from app.main import app
from app.core.logger import logger

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    
    # Detect if running on Heroku
    is_heroku = os.environ.get("DYNO") is not None
    
    # Configuration options
    config = {
        "host": host,
        "port": port,
        "workers": 1,  # Always use only 1 worker to prevent WebSocket issues
        "log_level": "info",
    }
    
    # Don't use reload on Heroku as it can cause issues
    if not is_heroku:
        config["reload"] = True
    
    logger.info(f"Starting server with config: {config}")
    
    try:
        # Run the server with the configured options
        uvicorn.run("app.main:app", **config)
    except Exception as e:
        logger.exception(f"Server failed to start: {e}")
        sys.exit(1) 