import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api, { TOKEN_KEY, setUnauthorizedHandler } from '@/services/api';
import { storage } from '@/services/storage';

export type UserRole = 'user' | 'moderator' | 'admin';

export type User = {
  id: number;
  username: string;
  email: string;
  role?: UserRole;
  is_active?: boolean;
  profile_picture?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>('/auth/profile');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      try {
        const token = await storage.getItem(TOKEN_KEY);
        if (token) await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    // Backend accepts either email or username in the `email` field
    const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
      email: identifier,
      password,
    });
    await storage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const { data } = await api.post<{ token: string; user: User }>('/auth/register', {
      username,
      email,
      password,
    });
    await storage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
  };

  const logout = async () => {
    await storage.deleteItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
