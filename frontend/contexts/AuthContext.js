import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';
import { useRouter } from 'next/router';

// Create the auth context
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // Check for existing token on mount
  useEffect(() => {
    const token = authApi.getToken();
    if (token) {
      // If we have a token, we're logged in
      // In a real app, you'd validate the token here
      setUser({ username: 'user' }); // Simplified user object
    }
    setLoading(false);
  }, []);

  // Login function
  const login = async (username, password) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Attempting login for user: ${username}`);
      const response = await authApi.login(username, password);
      
      console.log('Login response:', response.data);
      // The backend returns { token, user } instead of { access_token }
      const { token, user: userData } = response.data;
      
      // Store the token
      authApi.setToken(token);
      
      // Set the user with data from response
      setUser(userData || { username });
      
      // After successful login, redirect to projects page
      // This will trigger the project loading in ProjectContext
      router.push('/projects');
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || err.message || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    authApi.removeToken();
    setUser(null);
    
    // Redirect to login page after logout
    router.push('/login');
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!user;
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 