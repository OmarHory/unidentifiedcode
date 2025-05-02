import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

// Create the auth context
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const { access_token } = response.data;
      
      // Store the token
      authApi.setToken(access_token);
      
      // Set the user
      setUser({ username });
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login failed');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    authApi.removeToken();
    setUser(null);
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