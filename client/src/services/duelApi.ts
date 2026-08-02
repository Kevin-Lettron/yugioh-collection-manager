import api from './api';
import socketService from './socket';
import type {
  Duel,
  DuelAction,
  DuelStatus,
} from '../../../shared/types';

/**
 * Wrappers HTTP pour /api/duels + helpers WebSocket (subscribe / join / leave).
 * Le socket est deja connecte via socketService.connect() au login.
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
    api.post<{ duel: Duel }>(`/duels/${id}/accept`, { deck_id: deckId }).then((r) => r.data.duel),

  reject: (id: number) => api.post(`/duels/${id}/reject`).then((r) => r.data),

  cancel: (id: number) => api.post(`/duels/${id}/cancel`).then((r) => r.data),

  performAction: (id: number, action: DuelAction) =>
    api.post<{ duel: Duel }>(`/duels/${id}/action`, action).then((r) => r.data.duel),

  // ── WebSocket ─────────────────────────────────────────────────────────

  /**
   * Rejoint la room `duel:${id}` cote serveur. Le socket doit deja etre
   * connecte via socketService.connect(userId) au login.
   */
  joinRoom: (duelId: number) => {
    socketService.getSocket()?.emit('duel:join', { duelId });
  },

  leaveRoom: (duelId: number) => {
    socketService.getSocket()?.emit('duel:leave', { duelId });
  },

  /**
   * S'abonne aux updates temps reel d'un duel.
   * Renvoie une fonction de cleanup a appeler au unmount.
   */
  subscribeToDuel: (
    duelId: number,
    handlers: {
      onAction?: (data: { duel: Duel; action: DuelAction; actorId: number }) => void;
      onAccepted?: (data: { duel: Duel }) => void;
      onFinished?: (data: { duel: Duel; winnerId: number }) => void;
    }
  ): (() => void) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    socket.emit('duel:join', { duelId });
    if (handlers.onAction) socket.on('duel:action', handlers.onAction);
    if (handlers.onAccepted) socket.on('duel:accepted', handlers.onAccepted);
    if (handlers.onFinished) socket.on('duel:finished', handlers.onFinished);

    return () => {
      if (handlers.onAction) socket.off('duel:action', handlers.onAction);
      if (handlers.onAccepted) socket.off('duel:accepted', handlers.onAccepted);
      if (handlers.onFinished) socket.off('duel:finished', handlers.onFinished);
      socket.emit('duel:leave', { duelId });
    };
  },

  /**
   * Ecoute les nouveaux defis recus (room user:${myId} rejointe automatiquement au login).
   */
  subscribeToChallenges: (
    handlers: {
      onChallenged?: (data: { duel: Duel }) => void;
      onRejected?: (data: { duelId: number }) => void;
      onCancelled?: (data: { duelId: number }) => void;
    }
  ): (() => void) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    if (handlers.onChallenged) socket.on('duel:challenged', handlers.onChallenged);
    if (handlers.onRejected) socket.on('duel:rejected', handlers.onRejected);
    if (handlers.onCancelled) socket.on('duel:cancelled', handlers.onCancelled);

    return () => {
      if (handlers.onChallenged) socket.off('duel:challenged', handlers.onChallenged);
      if (handlers.onRejected) socket.off('duel:rejected', handlers.onRejected);
      if (handlers.onCancelled) socket.off('duel:cancelled', handlers.onCancelled);
    };
  },
};

export default duelApi;
