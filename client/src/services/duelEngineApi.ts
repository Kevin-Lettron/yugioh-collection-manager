import api from './api';
import socketService from './socket';
import type { DuelChoice, DuelStateResponse } from '../../../shared/duelView';

/**
 * Duel joué par le moteur ygopro-core.
 *
 * Le contrat est volontairement pauvre : on reçoit un plateau **déjà filtré**
 * de ce qu'on n'a pas le droit de voir, et une invite dont les options portent
 * des identifiants opaques. On renvoie ces identifiants, rien d'autre.
 *
 * Le front ne fabrique donc jamais de réponse pour le moteur, et ne connaît pas
 * son vocabulaire. C'est ce qui empêche un client de jouer à la place de son
 * adversaire ou de désigner une carte qu'on ne lui a pas proposée.
 */
export const duelEngineApi = {
  /** Ouvre la partie dans le moteur. À n'appeler qu'une fois, sur un duel accepté. */
  start: (duelId: number) =>
    api.post<DuelStateResponse>(`/duels/${duelId}/engine/start`).then((r) => r.data),

  /**
   * État courant, sans effet de bord.
   *
   * C'est l'appel du rechargement de page **et** celui de l'attente : quand
   * c'est à l'adversaire de jouer, on ne reçoit pas d'invite, seulement le
   * plateau. Le socket previent quand il faut redemander.
   */
  view: (duelId: number) =>
    api.get<DuelStateResponse>(`/duels/${duelId}/engine`).then((r) => r.data),

  /** Transmet la décision du joueur. */
  choose: (duelId: number, choice: DuelChoice) =>
    api.post<DuelStateResponse>(`/duels/${duelId}/engine/choose`, choice).then((r) => r.data),

  /** Ferme l'instance et libère la mémoire du moteur. */
  close: (duelId: number) => api.delete(`/duels/${duelId}/engine`).then((r) => r.data),

  /**
   * Écoute les changements d'état.
   *
   * Le serveur n'envoie **pas** l'état dans l'événement : il signale seulement
   * qu'il a changé. Chacun redemande ensuite *sa* vue — diffuser l'état dans la
   * salle commune révélerait la main de l'un à l'autre.
   */
  subscribe: (
    duelId: number,
    handlers: {
      onUpdate?: () => void;
      onEngineLost?: (data: { duelId: number; reason: string }) => void;
    }
  ): (() => void) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    const onUpdate = (data: { duelId: number }) => {
      if (data?.duelId === duelId) handlers.onUpdate?.();
    };
    const onLost = (data: { duelId: number; reason: string }) => {
      if (data?.duelId === duelId) handlers.onEngineLost?.(data);
    };

    socket.emit('duel:join', { duelId });
    socket.on('duel:engine_update', onUpdate);
    socket.on('duel:engine_lost', onLost);

    return () => {
      socket.off('duel:engine_update', onUpdate);
      socket.off('duel:engine_lost', onLost);
      socket.emit('duel:leave', { duelId });
    };
  },
};

export default duelEngineApi;
