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
    /** 'standard' (defaut, banlist appliquee) ou 'free' (aucune restriction). */
    rules_mode?: 'standard' | 'free';
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

  // ── Salle d'attente (migration 014) ───────────────────────────────────
  changeDeck: (id: number, deckId: number) =>
    api
      .post<{ duel: Duel }>(`/duels/${id}/change-deck`, { deck_id: deckId })
      .then((r) => r.data.duel),

  setReady: (id: number) =>
    api
      .post<{ duel: Duel; bothReady: boolean }>(`/duels/${id}/ready`)
      .then((r) => r.data),

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
   * S'abonne aux updates de la salle d'attente (change-deck + ready).
   * Ces events sont émis à la fois dans la room `duel:${id}` et dans les rooms
   * `user:${id}` des deux joueurs pour couvrir les cas où la room duel n'est
   * pas encore rejointe (chargement du lobby).
   */
  subscribeToLobby: (
    duelId: number,
    handlers: {
      onDeckChanged?: (data: { duel: Duel }) => void;
      onReadyChanged?: (data: { duel: Duel; bothReady: boolean }) => void;
    }
  ): (() => void) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};
    socket.emit('duel:join', { duelId });
    // Filet : ignorer les events qui ne concernent pas ce duel — un même socket
    // peut recevoir des events d'autres duels dans lesquels l'user est engagé.
    const wrap = <T extends { duel: Duel }>(fn?: (data: T) => void) =>
      fn ? (data: T) => data?.duel?.id === duelId && fn(data) : undefined;
    const onDeck = wrap(handlers.onDeckChanged);
    const onReady = wrap(handlers.onReadyChanged);
    if (onDeck) socket.on('duel:deck-changed', onDeck);
    if (onReady) socket.on('duel:ready-changed', onReady);
    return () => {
      if (onDeck) socket.off('duel:deck-changed', onDeck);
      if (onReady) socket.off('duel:ready-changed', onReady);
      socket.emit('duel:leave', { duelId });
    };
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
   * Ecoute l'acceptation d'un defi qu'on a lance.
   *
   * Le serveur emet `duel:accepted` dans la salle du duel ET dans celle du
   * challenger. C'est ce second envoi qui compte : le challenger n'a pas encore
   * rejoint la salle du duel, il attendrait donc indefiniment sans le savoir.
   */
  subscribeToAcceptance: (handler: (data: { duel: Duel }) => void): (() => void) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};
    socket.on('duel:accepted', handler);
    return () => socket.off('duel:accepted', handler);
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
