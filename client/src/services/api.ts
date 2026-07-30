import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

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

// Card scan with Claude Vision (photo never stored server-side)
export interface ScanResult {
  success: boolean;
  code?: string;
  name?: string;
  confidence?: number;
  card?: any;
  availableRarities?: string[];
  officialImage?: string;
  detectedLanguage?: string;
  notes?: string;
  error?: string;
  remainingScans?: number;
}

export const scanCard = async (photo: Blob, description?: string): Promise<ScanResult> => {
  const formData = new FormData();
  formData.append('photo', photo, 'scan.jpg');
  if (description && description.trim()) {
    formData.append('description', description.trim());
  }
  const response = await api.post<ScanResult>('/collection/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getScanStatus = async (): Promise<{ remaining: number; max: number; used: number }> => {
  const response = await api.get('/collection/scan/status');
  return response.data;
};

// Client-side debug logger. Uses fetch with keepalive so events survive tab kills.
export const debugLog = (event: string, data?: Record<string, unknown>): void => {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    fetch(`${API_URL}/api/debug/log`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        event,
        data: data || {},
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};

export default api;
export { API_URL };
