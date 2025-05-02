import { Toaster } from 'react-hot-toast';
import { ProjectProvider } from '../contexts/ProjectContext';
import { ChatProvider } from '../contexts/ChatContext';
import { DiffProvider } from '../contexts/DiffContext';
import { AuthProvider } from '../contexts/AuthContext';
import '../styles/globals.css';
import { useEffect } from 'react';
import logger from '../utils/logger';
import ErrorBoundary from '../components/ErrorBoundary';

function MyApp({ Component, pageProps }) {
  // Setup global error handling on mount
  useEffect(() => {
    logger.info('Application started');
    logger.setupGlobalErrorHandling();
    
    return () => {
      logger.info('Application stopped');
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProjectProvider>
          <ChatProvider>
            <DiffProvider>
              <Component {...pageProps} />
              <Toaster position="top-right" />
            </DiffProvider>
          </ChatProvider>
        </ProjectProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default MyApp; 