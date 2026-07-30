import api from '@/services/api';
import type {
  AIStatus,
  Deck,
  DeckComment,
  DeckValidation,
} from '@/types';

export const deckApi = {
  // ── Deck CRUD
  listMine: () => api.get<Deck[]>('/decks').then((r) => r.data),

  listPublic: (params: { page?: number; limit?: number; search?: string } = {}) =>
    api
      .get<{ data: Deck[]; total: number; page: number; total_pages: number }>(
        '/decks/public',
        { params }
      )
      .then((r) => r.data),

  get: (id: number) => api.get<Deck>(`/decks/${id}`).then((r) => r.data),

  create: (payload: { name: string; is_public: boolean; respect_banlist: boolean }) =>
    api.post<Deck>('/decks', payload).then((r) => r.data),

  update: (
    id: number,
    payload: { name?: string; is_public?: boolean; respect_banlist?: boolean }
  ) => api.put<Deck>(`/decks/${id}`, payload).then((r) => r.data),

  remove: (id: number) => api.delete(`/decks/${id}`).then((r) => r.data),

  validate: (id: number) =>
    api.get<DeckValidation>(`/decks/${id}/validate`).then((r) => r.data),

  // ── Deck cards
  addCard: (
    deckId: number,
    payload: { card_id: number; quantity: number; is_extra_deck: boolean }
  ) => api.post(`/decks/${deckId}/cards`, payload).then((r) => r.data),

  removeCard: (deckId: number, cardId: number) =>
    api.delete(`/decks/${deckId}/cards/${cardId}`).then((r) => r.data),

  setCardQuantity: (deckId: number, cardId: number, quantity: number) =>
    api.put(`/decks/${deckId}/cards/${cardId}`, { quantity }).then((r) => r.data),

  clearCards: (deckId: number) =>
    api.delete(`/decks/${deckId}/cards`).then((r) => r.data),

  // ── Share
  generateShare: (id: number) =>
    api
      .post<{ shareToken: string; shareUrl?: string }>(`/decks/${id}/share`)
      .then((r) => r.data),

  removeShare: (id: number) =>
    api.delete(`/decks/${id}/share`).then((r) => r.data),

  getShared: (shareToken: string) =>
    api.get<Deck>(`/decks/shared/${shareToken}`).then((r) => r.data),

  // ── Reactions
  like: (id: number) => api.post(`/reactions/decks/${id}/like`).then((r) => r.data),
  dislike: (id: number) =>
    api.post(`/reactions/decks/${id}/dislike`).then((r) => r.data),
  clearReaction: (id: number) =>
    api.delete(`/reactions/decks/${id}`).then((r) => r.data),

  // ── Comments
  listComments: (deckId: number) =>
    api.get<DeckComment[]>(`/comments/deck/${deckId}`).then((r) => r.data),

  createComment: (deckId: number, content: string) =>
    api
      .post<DeckComment>(`/comments/deck/${deckId}`, { content })
      .then((r) => r.data),

  replyComment: (commentId: number, content: string) =>
    api
      .post<DeckComment>(`/comments/${commentId}/reply`, { content })
      .then((r) => r.data),

  deleteComment: (commentId: number) =>
    api.delete(`/comments/${commentId}`).then((r) => r.data),

  // ── AI Deck Builder
  aiStatus: () => api.get<AIStatus>('/decks/ai/status').then((r) => r.data),

  aiBuild: (payload: { deck_id?: number; prompt: string; respect_banlist?: boolean }) =>
    api
      .post<{ deck: Deck; added: number; skipped: number; notes?: string }>(
        '/decks/ai/build',
        payload
      )
      .then((r) => r.data),
};
