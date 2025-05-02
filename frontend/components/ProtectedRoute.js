import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

// Component to wrap routes that require authentication
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !isAuthenticated()) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);
  
  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
      </div>
    );
  }
  
  // If not authenticated, don't render children (will redirect)
  if (!isAuthenticated()) {
    return null;
  }
  
  // If authenticated, render children
  return <>{children}</>;
} 