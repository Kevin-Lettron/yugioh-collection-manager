import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { reportClientError } from './crashReporter';

const API_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error: string }>) => {
    if (error.response) {
      const message = error.response.data?.error || 'Une erreur est survenue';

      // Remontée serveur : un 401 est une situation normale (session expirée),
      // et l'endpoint de report lui-même est exclu pour ne pas boucler.
      const url = error.config?.url || '';
      if (error.response.status !== 401 && !url.includes('client-errors')) {
        reportClientError({
          message: `HTTP ${error.response.status} · ${error.config?.method?.toUpperCase()} ${url}`,
          context: {
            status: error.response.status,
            url,
            method: error.config?.method,
            // Le corps de la réponse dit souvent pourquoi, là où le toast
            // générique ne dit rien.
            body: JSON.stringify(error.response.data)?.slice(0, 600),
          },
        });
      }

      // Handle authentication errors
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        toast.error('Session expirée. Veuillez vous reconnecter.');
      } else {
        toast.error(message);
      }
    } else if (error.request) {
      toast.error('Erreur réseau. Veuillez vérifier votre connexion.');
    } else {
      toast.error('Une erreur inattendue est survenue.');
    }

    return Promise.reject(error);
  }
);

// Helper to get full URL for uploaded images
export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Otherwise, prepend API_URL
  return `${API_URL}${path}`;
};

// ─────────────────────────────────────────────────────────────
// Admin API — endpoints under /api/admin, all require admin role
// ─────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  activeUsers7d: number;
  decks: number;
  totalCardsInCollections: number;
  uniqueCardEntries: number;
  comments: number;
  roleBreakdown: { role: string; count: number }[];
  recentSignups: {
    id: number;
    username: string;
    email: string;
    role: string;
    created_at: string;
  }[];
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  is_active: boolean;
  disabled_at: string | null;
  profile_picture?: string;
  created_at: string;
  updated_at: string;
  deck_count: number;
  card_count: number;
}

export interface AdminDeck {
  id: number;
  name: string;
  is_public: boolean;
  respect_banlist: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  user_id: number;
  username: string;
  user_role: string;
  card_count: number;
  likes: number;
  comments: number;
}

export interface AdminComment {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  parent_comment_id: number | null;
  user_id: number;
  username: string;
  deck_id: number;
  deck_name: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),

  listUsers: (params: { page?: number; limit?: number; search?: string; role?: string } = {}) =>
    api.get<PaginationMeta & { users: AdminUser[] }>('/admin/users', { params }).then((r) => r.data),

  getUser: (id: number) => api.get<{ user: AdminUser }>(`/admin/users/${id}`).then((r) => r.data.user),

  updateUserRole: (id: number, role: 'user' | 'moderator' | 'admin') =>
    api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data),

  toggleUserActive: (id: number, is_active: boolean) =>
    api.patch(`/admin/users/${id}/status`, { is_active }).then((r) => r.data),

  deleteUser: (id: number) => api.delete(`/admin/users/${id}`).then((r) => r.data),

  listDecks: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get<PaginationMeta & { decks: AdminDeck[] }>('/admin/decks', { params }).then((r) => r.data),

  deleteDeck: (id: number) => api.delete(`/admin/decks/${id}`).then((r) => r.data),

  forceUnshareDeck: (id: number) => api.post(`/admin/decks/${id}/unshare`).then((r) => r.data),

  listComments: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api.get<PaginationMeta & { comments: AdminComment[] }>('/admin/comments', { params }).then((r) => r.data),

  deleteComment: (id: number) => api.delete(`/admin/comments/${id}`).then((r) => r.data),
};

export default api;
export { API_URL };
