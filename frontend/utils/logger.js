/**
 * Logger utility for frontend application
 * Logs to console and to a file via backend API
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

class Logger {
  constructor() {
    this.backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    // Enable/disable different log types
    this.config = {
      consoleLogging: true,
      fileLogging: true,
      consoleLevel: LOG_LEVELS.DEBUG,
    };
  }

  /**
   * Send logs to backend
   */
  async _sendToBackend(level, message, details = {}) {
    if (!this.config.fileLogging) return;
    
    try {
      const payload = {
        level,
        message,
        details,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : '',
      };

      // Use fetch to send log to backend
      fetch(`${this.backendUrl}/api/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // Don't wait for response
        keepalive: true,
      }).catch(err => {
        // Silently fail if backend logging fails
        console.error('Failed to send log to backend:', err);
      });
    } catch (error) {
      // Fallback to console if sending to backend fails
      console.error('Error in frontend logging:', error);
    }
  }

  /**
   * Log to console based on configuration
   */
  _logToConsole(level, message, details = {}) {
    if (!this.config.consoleLogging) return;
    
    const consoleMethod = {
      [LOG_LEVELS.DEBUG]: console.debug,
      [LOG_LEVELS.INFO]: console.info,
      [LOG_LEVELS.WARN]: console.warn,
      [LOG_LEVELS.ERROR]: console.error,
    }[level] || console.log;
    
    consoleMethod(`[${level.toUpperCase()}] ${message}`, details);
  }

  /**
   * Main logging method
   */
  log(level, message, details = {}) {
    this._logToConsole(level, message, details);
    this._sendToBackend(level, message, details);
  }

  // Convenience methods
  debug(message, details = {}) {
    this.log(LOG_LEVELS.DEBUG, message, details);
  }

  info(message, details = {}) {
    this.log(LOG_LEVELS.INFO, message, details);
  }

  warn(message, details = {}) {
    this.log(LOG_LEVELS.WARN, message, details);
  }

  error(message, details = {}) {
    this.log(LOG_LEVELS.ERROR, message, details);
    
    // If details contains an error object with stack, log it
    if (details.error && details.error.stack) {
      this._logToConsole(LOG_LEVELS.ERROR, 'Stack trace:', details.error.stack);
    }
  }

  /**
   * Capture unhandled exceptions and rejections
   */
  setupGlobalErrorHandling() {
    if (typeof window !== 'undefined') {
      // Capture unhandled exceptions
      window.addEventListener('error', (event) => {
        this.error('Unhandled exception', {
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      });

      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled promise rejection', {
          reason: event.reason,
          error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        });
      });
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger instance
export default logger; 