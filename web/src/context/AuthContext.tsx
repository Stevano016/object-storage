import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../types';

const TOKEN_STORAGE_KEY = 'gentan_token';
const USER_STORAGE_KEY = 'gentan_user';

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

/**
 * In production the API is served from the same origin as the dashboard.
 * During development Vite runs on 5173 while the backend stays on 5000.
 */
function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  apiUrl: string;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  apiFetch: <T = any>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const apiUrl = useMemo(resolveApiUrl, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const apiFetch = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${apiUrl}${path}`, { ...options, headers });

    // 401 means the session itself is gone; 403 only means this account lacks
    // the permission, which must not kick the user out of the dashboard.
    if (response.status === 401) {
      logout();
      throw new Error('Sesi Anda telah berakhir. Silakan masuk kembali.');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Permintaan gagal (HTTP ${response.status}).`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return response as unknown as T;
  }, [apiUrl, token, logout]);

  /** Re-reads the account so role changes made by a superadmin apply without a re-login. */
  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const data = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      if (data?.user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch {
      // A failed refresh is not fatal: 401 already logged the user out.
    }
  }, [token, apiFetch]);

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    isAuthenticated: Boolean(token),
    isSuperAdmin: user?.role === 'superadmin',
    apiUrl,
    login,
    logout,
    refreshUser,
    apiFetch
  }), [token, user, apiUrl, login, logout, refreshUser, apiFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
