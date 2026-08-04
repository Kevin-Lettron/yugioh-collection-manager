import api from '@/services/api';
import type { NewsItem, NewsRelease, NewsTopic, NewsTopicMeta } from '@/types';

/**
 * Enveloppes renvoyees par les endpoints /news/*. Les controllers
 * (`server/src/controllers/newsController.ts`) enveloppent systematiquement les
 * tableaux dans un objet nomme (items, topics, releases) — on garde la meme
 * forme cote client pour ne pas mentir sur ce que renvoie le back.
 */
interface NewsListResponse {
  items: NewsItem[];
  total: number;
  page: number;
  limit: number;
}

interface NewsTopicsResponse {
  topics: NewsTopicMeta[];
}

interface NewsReleasesResponse {
  releases: NewsRelease[];
}

/**
 * Wrapper mince autour d'`axios` : chaque appel deballe la reponse et renvoie
 * la charge utile directement (items, topics, releases), plutot que d'imposer
 * `.items` a chaque site d'appel.
 */
export const newsApi = {
  /**
   * Fil d'articles. Si `topics` est omis et que l'utilisateur est authentifie
   * avec des abonnements, le back filtre implicitement sur ces abonnements
   * (cf. NewsController#list). Passer `topics: []` a le meme effet qu'omettre.
   */
  list: (params: { topics?: NewsTopic[]; page?: number; limit?: number } = {}) => {
    const query: Record<string, string | number> = {};
    if (params.topics && params.topics.length > 0) {
      query.topics = params.topics.join(',');
    }
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    return api
      .get<NewsListResponse>('/news', { params: query })
      .then((r) => r.data);
  },

  /** Liste des 6 themes + etat d'abonnement du compte connecte (`subscribed`). */
  getTopics: () =>
    api.get<NewsTopicsResponse>('/news/topics').then((r) => r.data.topics),

  /**
   * Remplace la liste d'abonnements du compte connecte. Les cles inconnues sont
   * ignorees cote back — on garde la meme tolerance ici (pas de validation
   * locale dupliquee).
   */
  setTopics: (topics: NewsTopic[]) =>
    api
      .put<NewsTopicsResponse>('/news/topics', { topics })
      .then((r) => r.data.topics),

  /**
   * Sorties d'extensions. `window` distingue « a venir » de « recentes ». Le
   * back applique un defaut de 90 jours pour upcoming, 30 pour recent — on
   * s'aligne dessus en laissant `days` optionnel.
   */
  getReleases: (window: 'upcoming' | 'recent', days?: number) => {
    const params: Record<string, string | number> = { window };
    if (days) params.days = days;
    return api
      .get<NewsReleasesResponse>('/news/releases', { params })
      .then((r) => r.data.releases);
  },
};

export default newsApi;
