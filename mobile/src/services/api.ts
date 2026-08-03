import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/config';
import { storage } from '@/services/storage';

export const TOKEN_KEY = 'ygo_token';

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await storage.deleteItem(TOKEN_KEY);
      onUnauthorized?.();
      return Promise.reject(error);
    }

    // Remontée serveur des erreurs d'API. Le crashReporter ne capte que les
    // exceptions JS : une requête qui échoue produit une Alert et disparaît
    // sans laisser de trace exploitable.
    //
    // Import différé : ce module est chargé au démarrage, et crashReporter
    // importe `api` — un import statique créerait un cycle.
    try {
      const { reportCrash } = await import('@/services/crashReporter');
      const url = error.config?.url || '';
      const method = error.config?.method?.toUpperCase() || '';
      if (!url.includes('client-errors')) {
        reportCrash({
          message: error.response
            ? `HTTP ${error.response.status} · ${method} ${url}`
            : `Réseau injoignable · ${method} ${url}`,
          context: {
            status: error.response?.status,
            url,
            method,
            // Le corps de la réponse dit généralement pourquoi.
            body: JSON.stringify(error.response?.data)?.slice(0, 600),
          },
        });
      }
    } catch {
      /* la remontée ne doit jamais empêcher la gestion normale de l'erreur */
    }

    return Promise.reject(error);
  }
);

export const getImageUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_URL}${path}`;
};

export default api;
