import api from '@/services/api';
import type {
  Card,
  CardLanguage,
  CollectionFilters,
  PaginatedResponse,
  ScanResult,
  UserCard,
} from '@/types';

export type SearchResult = {
  card: Card;
  matchedSet?: { set_code: string; set_rarity: string; set_name?: string };
  availableSets: { set_code: string; set_rarity: string; set_name?: string }[];
  detectedLanguage?: CardLanguage;
  originalSetCode?: string;
};

export const collectionApi = {
  list: (filters: CollectionFilters = {}) =>
    api
      .get<PaginatedResponse<UserCard>>('/collection/cards', { params: filters })
      .then((r) => r.data),

  search: (code: string) =>
    api
      .get<SearchResult>('/collection/search', { params: { code } })
      .then((r) => r.data),

  add: (payload: {
    card_code: string;
    set_code: string;
    rarity: string;
    language: CardLanguage;
    quantity: number;
  }) => api.post('/collection/cards/add', payload).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/collection/cards/${id}`).then((r) => r.data),

  setQuantity: (id: number, quantity: number) =>
    api
      .put(`/collection/cards/${id}/quantity`, { quantity })
      .then((r) => r.data),

  /**
   * Scan a card photo via Claude Vision.
   * `photoUri` is a local file URI from expo-camera or expo-image-picker.
   * `mimeType` defaults to image/jpeg.
   */
  scan: async (
    photoUri: string,
    opts?: { description?: string; mimeType?: string; fileName?: string }
  ): Promise<ScanResult> => {
    const formData = new FormData();
    // React Native FormData accepts { uri, name, type } object literal
    formData.append('photo', {
      uri: photoUri,
      name: opts?.fileName || 'scan.jpg',
      type: opts?.mimeType || 'image/jpeg',
    } as unknown as Blob);
    if (opts?.description) formData.append('description', opts.description);

    const response = await api.post<ScanResult>('/collection/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  scanStatus: () =>
    api
      .get<{ remaining: number; max: number; used: number }>('/collection/scan/status')
      .then((r) => r.data),
};
