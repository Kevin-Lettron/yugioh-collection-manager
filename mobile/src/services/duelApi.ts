import api from '@/services/api';
import type { Duel, DuelAction, DuelStatus } from '@/types';

/**
 * Wrappers HTTP pour /api/duels cote mobile.
 *
 * Note : contrairement au client web, le mobile ne wrappe PAS le socket.io ici
 * car la dep `socket.io-client` n'est pas installee (contrainte "pas de nouvelle
 * dep"). Pour la fondation temps reel, on s'appuie sur du polling cote ecran
 * (refetch periodique de duelApi.get) — le hook UI ajoutera ca. Le back emet
 * quand meme les events, ils seront branches quand la dep sera ajoutee.
 */
export const duelApi = {
  challenge: (payload: {
    opponent_id?: number;
    opponent_username?: string;
    challenger_deck_id?: number;
  }) => api.post<{ duel: Duel }>('/duels', payload).then((r) => r.data),

  listMine: (status?: DuelStatus) =>
    api
      .get<{ duels: Duel[] }>('/duels', { params: status ? { status } : {} })
      .then((r) => r.data.duels),

  get: (id: number) => api.get<{ duel: Duel }>(`/duels/${id}`).then((r) => r.data.duel),

  accept: (id: number, deckId: number) =>
    api
      .post<{ duel: Duel }>(`/duels/${id}/accept`, { deck_id: deckId })
      .then((r) => r.data.duel),

  reject: (id: number) => api.post(`/duels/${id}/reject`).then((r) => r.data),

  cancel: (id: number) => api.post(`/duels/${id}/cancel`).then((r) => r.data),

  performAction: (id: number, action: DuelAction) =>
    api
      .post<{ duel: Duel }>(`/duels/${id}/action`, action)
      .then((r) => r.data.duel),

  // ── Salle d'attente (migration 014) ─────────────────────────────────────
  changeDeck: (id: number, deckId: number) =>
    api
      .post<{ duel: Duel }>(`/duels/${id}/change-deck`, { deck_id: deckId })
      .then((r) => r.data.duel),

  setReady: (id: number) =>
    api
      .post<{ duel: Duel; bothReady: boolean }>(`/duels/${id}/ready`)
      .then((r) => r.data),
};

export default duelApi;
