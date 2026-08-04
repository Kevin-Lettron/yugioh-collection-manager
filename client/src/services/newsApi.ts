/**
 * Actualités — wrapper axios sur `/api/news`.
 *
 * Miroir strict des endpoints exposés par `server/src/routes/newsRoutes.ts` :
 *   GET  /api/news             → fil paginé
 *   GET  /api/news/topics      → liste des 6 thèmes + état d'abonnement
 *   PUT  /api/news/topics      → maj abonnements → renvoie l'état à jour
 *   GET  /api/news/releases    → calendrier des sorties (upcoming/recent)
 *
 * Les types viennent de `shared/types` — on ne redéfinit rien côté client.
 */

import api from './api';
import type {
  NewsItem,
  NewsRelease,
  NewsTopic,
  NewsTopicMeta,
} from '../../../shared/types';

export interface NewsListParams {
  topics?: NewsTopic[];
  page?: number;
  limit?: number;
}

export interface NewsListResponse {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

export interface NewsTopicsResponse {
  topics: NewsTopicMeta[];
}

export interface NewsReleasesResponse {
  releases: NewsRelease[];
}

export const newsApi = {
  list: async (params: NewsListParams = {}): Promise<NewsListResponse> => {
    // Les topics sont sérialisés en CSV côté serveur : on aplatit ici pour
    // qu'axios ne les envoie pas en `topics[]=` (répétition), format que le
    // contrôleur ne parse pas.
    const query: Record<string, string | number> = {};
    if (params.topics && params.topics.length > 0) query.topics = params.topics.join(',');
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;

    const r = await api.get<NewsListResponse>('/news', { params: query });
    return r.data;
  },

  getTopics: async (): Promise<NewsTopicsResponse> => {
    const r = await api.get<NewsTopicsResponse>('/news/topics');
    return r.data;
  },

  setTopics: async (topics: NewsTopic[]): Promise<NewsTopicsResponse> => {
    const r = await api.put<NewsTopicsResponse>('/news/topics', { topics });
    return r.data;
  },

  getReleases: async (
    window: 'upcoming' | 'recent',
    days?: number,
  ): Promise<NewsReleasesResponse> => {
    const params: Record<string, string | number> = { window };
    if (days) params.days = days;
    const r = await api.get<NewsReleasesResponse>('/news/releases', { params });
    return r.data;
  },
};

export default newsApi;
