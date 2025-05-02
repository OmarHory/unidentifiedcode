import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginForm() {
  const [username, setUsername] = useState('test');
  const [password, setPassword] = useState('test');
  const { login, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(username, password);
  };

  return (
    <div className="bg-background-light p-6 rounded-lg shadow-lg max-w-md w-full mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      
      {error && (
        <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-300 mb-2" htmlFor="username">
            Username
          </label>
          <input
            type="text"
            id="username"
            className="w-full bg-background border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-primary"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <p className="text-gray-500 text-xs mt-1">Use any username (dev mode)</p>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-300 mb-2" htmlFor="password">
            Password
          </label>
          <input
            type="password"
            id="password"
            className="w-full bg-background border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-gray-500 text-xs mt-1">Use any password (dev mode)</p>
        </div>
        
        <button
          type="submit"
          className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
} 