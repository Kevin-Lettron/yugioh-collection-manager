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
  updateProfile: (updates: { username?: string; email?: string; password?: string; profile_picture?: string }) => Promise<void>;
  uploadAvatar: (photoUri: string, mimeType?: string) => Promise<void>;
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

  const updateProfile = async (updates: {
    username?: string;
    email?: string;
    password?: string;
    profile_picture?: string;
  }) => {
    const { data } = await api.put<{ user: User }>('/auth/profile', updates);
    setUser(data.user);
  };

  const uploadAvatar = async (photoUri: string, mimeType: string = 'image/jpeg') => {
    const form = new FormData();
    // RN FormData accepte { uri, name, type }
    form.append('avatar', {
      uri: photoUri,
      name: `avatar.${mimeType.split('/')[1] || 'jpg'}`,
      type: mimeType,
    } as unknown as Blob);
    const { data } = await api.post<{ user: User }>('/auth/upload-avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    });
    setUser(data.user);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refresh, updateProfile, uploadAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
