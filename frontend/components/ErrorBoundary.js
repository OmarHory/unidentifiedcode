import React from 'react';
import logger from '../utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to our logging system
    logger.error('Component error caught by ErrorBoundary', {
      error,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return this.props.fallback || (
        <div className="p-4 rounded bg-red-50 border border-red-200">
          <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="text-sm text-red-600 mt-1">
            The error has been logged. Please try reloading the page.
          </p>
          {this.props.showError && this.state.error && (
            <pre className="mt-4 p-2 bg-red-100 text-xs text-red-800 overflow-auto rounded">
              {this.state.error.toString()}
            </pre>
          )}
          <button 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 