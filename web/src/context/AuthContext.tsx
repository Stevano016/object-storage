import React, { createContext, useContext, useState } from 'react';

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  apiUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('gentan_token'));
  const [user, setUser] = useState<User | null>(
    localStorage.getItem('gentan_user') ? JSON.parse(localStorage.getItem('gentan_user')!) : null
  );

  // Set default API URL based on environment
  // If in production on VPS, API is served on the same host, so we use origin.
  // In development, Vite runs on 5173, backend runs on 5000.
  const apiUrl = import.meta.env.VITE_API_URL || 
                 (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('gentan_token', newToken);
    localStorage.setItem('gentan_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('gentan_token');
    localStorage.removeItem('gentan_user');
    setToken(null);
    setUser(null);
  };

  const apiFetch = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    
    // Inject Authorization header if token exists
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      // Auto logout if JWT expires or is rejected
      logout();
      throw new Error('Session expired or unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    // Check if the response is JSON, otherwise return text or blob
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    
    return response;
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout, apiFetch, apiUrl }}>
      {children}
    </AuthContext.Provider>
  );
};
