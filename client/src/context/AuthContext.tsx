import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearStoredAuth,
  getStoredToken,
  getStoredUsername,
  loginApi,
  meApi,
  registerApi,
  setStoredAuth,
} from '../lib/api';

interface AuthContextValue {
  username: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    meApi()
      .then((u) => setUsername(u.username))
      .catch(() => {
        clearStoredAuth();
        setUsername(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (u: string, p: string) => {
    const data = await loginApi(u, p);
    setStoredAuth(data.token, data.username);
    setUsername(data.username);
  }, []);

  const register = useCallback(async (u: string, p: string) => {
    const data = await registerApi(u, p);
    setStoredAuth(data.token, data.username);
    setUsername(data.username);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        username,
        isAuthenticated: Boolean(username),
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getWelcomeMessage(name: string): string {
  return `嗨，${name}！我是 cc404喵，你的视觉对话小助手～\n点击「开始对话」，对准摄像头，直接说话就行！`;
}
