import logging
import os
import sys
import socket
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from pathlib import Path
import time
import traceback
from datetime import datetime

# Create logs directory if it doesn't exist
logs_dir = Path("logs")
logs_dir.mkdir(exist_ok=True)

# Configure logger
def setup_logger(name="speakcode", log_file="logs/backend.log"):
    logger = logging.getLogger(name)
    
    # Make sure we don't add handlers multiple times
    if logger.handlers:
        return logger
    
    # Set level
    logger.setLevel(logging.DEBUG)
    
    # Get hostname
    hostname = socket.gethostname()
    
    # Create formatters with more detailed information
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - '
        '%(module)s.%(funcName)s:%(lineno)d - %(message)s'
    )
    
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(process)d] - '
        '%(pathname)s:%(lineno)d - %(message)s'
    )
    
    console_formatter = logging.Formatter(
        '%(levelname)s: [%(asctime)s] %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Standard log file handler (with rotation to prevent huge log files)
    file_handler = RotatingFileHandler(
        log_file, maxBytes=10*1024*1024, backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(file_formatter)
    
    # Error log file handler - separate file for ERROR and CRITICAL logs
    error_log_file = "logs/error.log"
    error_file_handler = RotatingFileHandler(
        error_log_file, maxBytes=10*1024*1024, backupCount=5
    )
    error_file_handler.setLevel(logging.ERROR)
    error_file_handler.setFormatter(detailed_formatter)
    
    # Daily rotating log file for audit purposes
    audit_log_file = "logs/audit.log"
    audit_file_handler = TimedRotatingFileHandler(
        audit_log_file, when='midnight', interval=1, backupCount=30
    )
    audit_file_handler.setLevel(logging.INFO)
    audit_file_handler.setFormatter(file_formatter)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(console_formatter)
    
    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(error_file_handler)
    logger.addHandler(audit_file_handler)
    logger.addHandler(console_handler)
    
    # Set propagate to False to avoid duplicate logs
    logger.propagate = False
    
    return logger

# Create and export logger instance
logger = setup_logger()

def log_exception(exc_type, exc_value, exc_traceback):
    """
    Log uncaught exceptions to the configured logger with detailed context
    """
    if issubclass(exc_type, KeyboardInterrupt):
        # Don't log keyboard interrupt events
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return
    
    # Format traceback for more readable output
    trace = traceback.format_exception(exc_type, exc_value, exc_traceback)
    trace_str = "".join(trace)
    
    # Add execution context
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    hostname = socket.gethostname()
    pid = os.getpid()
    
    error_message = (
        f"Uncaught exception at {timestamp} on {hostname} (PID: {pid}):\n"
        f"Type: {exc_type.__name__}\n"
        f"Value: {exc_value}\n"
        f"Traceback:\n{trace_str}"
    )
    
    logger.critical(error_message)

# Set the exception hook to catch unhandled exceptions
sys.excepthook = log_exception

def get_request_logger(request_id=None):
    """
    Create a logger that includes request_id in all log messages
    """
    if not request_id:
        request_id = f"{int(time.time())}-{os.getpid()}"
    
    class RequestAdapter(logging.LoggerAdapter):
        def process(self, msg, kwargs):
            return f"[Request-{request_id}] {msg}", kwargs
    
    return RequestAdapter(logger, {}) 