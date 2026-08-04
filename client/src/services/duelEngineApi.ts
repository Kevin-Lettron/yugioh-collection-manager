import api from './api';
import socketService from './socket';
import type {
  DuelAnnounceSearchResult,
  DuelChoice,
  DuelPreGameState,
  DuelStateResponse,
} from '../../../shared/duelView';

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
/**
 * Réponse polymorphe de `start` :
 *   - `{ preGame }` tant qu'on est en pile ou face
 *   - `DuelStateResponse` quand le moteur est effectivement lancé
 * Le status HTTP tranche (202 vs 200), mais on distingue aussi sur la présence
 * du champ pour rester robuste à un proxy qui aplatirait les status.
 */
export type EngineStartResult =
  | { kind: 'pre_game'; preGame: DuelPreGameState }
  | { kind: 'active'; state: DuelStateResponse };

function classifyStart(data: unknown, status: number): EngineStartResult {
  if (data && typeof data === 'object' && 'preGame' in (data as any)) {
    return { kind: 'pre_game', preGame: (data as any).preGame };
  }
  if (status === 202) {
    return { kind: 'pre_game', preGame: (data as any) as DuelPreGameState };
  }
  return { kind: 'active', state: data as DuelStateResponse };
}

export const duelEngineApi = {
  /**
   * Ouvre la partie dans le moteur — trois étapes possibles selon l'avancée :
   *   1. Aucune préparation : entre en pré-game (pile ou face) et renvoie
   *      `{ kind: 'pre_game' }`.
   *   2. Pré-game en cours : idem, retour de l'état.
   *   3. Pré-game résolu : le moteur est créé, on obtient `{ kind: 'active' }`.
   */
  start: (duelId: number): Promise<EngineStartResult> =>
    api
      .post(`/duels/${duelId}/engine/start`, undefined, { validateStatus: (s) => s < 400 })
      .then((r) => classifyStart(r.data, r.status)),

  /** État courant du pile ou face, pour un poll ou un rechargement de page. */
  preGame: (duelId: number): Promise<DuelPreGameState> =>
    api
      .get<{ preGame: DuelPreGameState }>(`/duels/${duelId}/engine/pre-game`)
      .then((r) => r.data.preGame),

  /** « Je clique pour lancer la pièce ». Au deuxième clic, le serveur tire. */
  coinFlip: (duelId: number): Promise<DuelPreGameState> =>
    api
      .post<{ preGame: DuelPreGameState }>(`/duels/${duelId}/coin-flip`)
      .then((r) => r.data.preGame),

  /** Réservé au vainqueur du pile ou face. */
  firstPlayerChoice: (duelId: number, choice: 'P1' | 'P2'): Promise<DuelPreGameState> =>
    api
      .post<{ preGame: DuelPreGameState }>(`/duels/${duelId}/first-player-choice`, { choice })
      .then((r) => r.data.preGame),

  /** Abandon (moteur) : marque la victoire à l'adversaire et arrête le duel. */
  surrender: (duelId: number): Promise<{ winnerId: number }> =>
    api
      .post<{ ok: true; winnerId: number }>(`/duels/${duelId}/engine/surrender`)
      .then((r) => ({ winnerId: r.data.winnerId })),

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

  /** F7 · Vue spectateur (mains adverses invisibles, aucun prompt). */
  spectate: (duelId: number): Promise<DuelStateResponse> =>
    api
      .get<{ state: DuelStateResponse; spectator: true }>(`/duels/${duelId}/engine/spectate`)
      .then((r) => r.data.state),

  /**
   * Recherche de cartes déclarables pour l'invite ANNOUNCE_CARD.
   *
   * Le serveur filtre par les opcodes du moteur : le front n'a qu'à faire
   * remonter le texte tapé, il ne verra que des cartes que le moteur va
   * accepter. Débounce recommandé côté appelant — ~200 ms suffisent.
   */
  announceSearch: (duelId: number, query: string) =>
    api
      .post<{ results: DuelAnnounceSearchResult[] }>(
        `/duels/${duelId}/engine/announce-card/search`,
        { query }
      )
      .then((r) => r.data.results),

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
      onPreGame?: (state: DuelPreGameState) => void;
      onFinished?: (data: { winnerId: number; reason: string }) => void;
    }
  ): (() => void) => {
    const onUpdate = (data: { duelId: number }) => {
      if (data?.duelId === duelId) handlers.onUpdate?.();
    };
    const onLost = (data: { duelId: number; reason: string }) => {
      if (data?.duelId === duelId) handlers.onEngineLost?.(data);
    };
    const onPreGame = (data: { duelId: number; state: DuelPreGameState }) => {
      if (data?.duelId === duelId) handlers.onPreGame?.(data.state);
    };
    const onFinished = (data: { duelId: number; winnerId: number; reason: string }) => {
      if (data?.duelId === duelId) {
        handlers.onFinished?.({ winnerId: data.winnerId, reason: data.reason });
      }
    };

    let attached: ReturnType<typeof socketService.getSocket> = null;

    const attach = (): boolean => {
      const socket = socketService.getSocket();
      if (!socket) return false;
      attached = socket;
      socket.emit('duel:join', { duelId });
      socket.on('duel:engine_update', onUpdate);
      socket.on('duel:engine_lost', onLost);
      socket.on('duel:pregame', onPreGame);
      socket.on('duel:finished', onFinished);
      return true;
    };

    let retry: ReturnType<typeof setInterval> | null = null;
    if (!attach()) {
      retry = setInterval(() => {
        if (attach() && retry) {
          clearInterval(retry);
          retry = null;
        }
      }, 500);
    }

    return () => {
      if (retry) clearInterval(retry);
      if (!attached) return;
      attached.off('duel:engine_update', onUpdate);
      attached.off('duel:engine_lost', onLost);
      attached.off('duel:pregame', onPreGame);
      attached.off('duel:finished', onFinished);
      attached.emit('duel:leave', { duelId });
    };
  },
};

export default duelEngineApi;
