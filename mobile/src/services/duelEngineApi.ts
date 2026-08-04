import api from '@/services/api';
import socketService from '@/services/socket';
import type {
  DuelChoice,
  DuelPreGameState,
  DuelStateResponse,
} from '@/types';

/**
 * Miroir mobile de `client/src/services/duelEngineApi.ts` — F8 du plan.
 *
 * Bloc 5 : ajout de `subscribe()` (socket.io-client), `announceSearch()`
 * (ANNOUNCE_CARD) et `spectate()`. Le poll historique de 1.5 s reste en
 * filet de secours quand le socket est absent — voir engine/[id].tsx.
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

export interface DuelAnnounceSearchResult {
  code: number;
  name: string;
}

/**
 * Callbacks d'abonnement socket. Miroir du web — le back n'envoie pas
 * l'état complet dans le broadcast (fuite d'info entre les deux mains),
 * chacun redemande sa vue via `onUpdate`.
 */
export interface DuelSubscribeHandlers {
  onUpdate?: () => void;
  onEngineLost?: (data: { duelId: number; reason: string }) => void;
  onPreGame?: (state: DuelPreGameState) => void;
  onFinished?: (data: { winnerId: number; reason: string }) => void;
}

export const duelEngineApi = {
  start: (duelId: number): Promise<EngineStartResult> =>
    api
      .post(`/duels/${duelId}/engine/start`, undefined, {
        validateStatus: (s: number) => s < 400,
      })
      .then((r: any) => classifyStart(r.data, r.status)),

  preGame: (duelId: number): Promise<DuelPreGameState> =>
    api
      .get<{ preGame: DuelPreGameState }>(`/duels/${duelId}/engine/pre-game`)
      .then((r) => r.data.preGame),

  coinFlip: (duelId: number): Promise<DuelPreGameState> =>
    api
      .post<{ preGame: DuelPreGameState }>(`/duels/${duelId}/coin-flip`)
      .then((r) => r.data.preGame),

  firstPlayerChoice: (duelId: number, choice: 'P1' | 'P2'): Promise<DuelPreGameState> =>
    api
      .post<{ preGame: DuelPreGameState }>(`/duels/${duelId}/first-player-choice`, { choice })
      .then((r) => r.data.preGame),

  surrender: (duelId: number): Promise<{ winnerId: number }> =>
    api
      .post<{ ok: true; winnerId: number }>(`/duels/${duelId}/engine/surrender`)
      .then((r) => ({ winnerId: r.data.winnerId })),

  view: (duelId: number): Promise<DuelStateResponse> =>
    api.get<DuelStateResponse>(`/duels/${duelId}/engine`).then((r) => r.data),

  choose: (duelId: number, choice: DuelChoice): Promise<DuelStateResponse> =>
    api.post<DuelStateResponse>(`/duels/${duelId}/engine/choose`, choice).then((r) => r.data),

  spectate: (duelId: number): Promise<DuelStateResponse> =>
    api
      .get<{ state: DuelStateResponse }>(`/duels/${duelId}/engine/spectate`)
      .then((r) => r.data.state),

  /**
   * ANNOUNCE_CARD — recherche typeahead filtrée par les opcodes moteur.
   * Le serveur ne renvoie que des cartes que le moteur acceptera.
   */
  announceSearch: (duelId: number, query: string): Promise<DuelAnnounceSearchResult[]> =>
    api
      .post<{ results: DuelAnnounceSearchResult[] }>(
        `/duels/${duelId}/engine/announce-card/search`,
        { query }
      )
      .then((r) => r.data.results),

  /**
   * Bloc 5 · abonne l'écran aux événements moteur temps réel.
   *
   * Renvoie une fonction de désabonnement à appeler dans le cleanup useEffect.
   * Si le socket est indisponible (mode dégradé), on renvoie un noop et
   * l'écran retombe sur son poll — c'est le contrat du web.
   */
  subscribe: (duelId: number, handlers: DuelSubscribeHandlers): (() => void) => {
    let attached: ReturnType<typeof socketService.getSocket> = null;
    let cancelled = false;

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

    void socketService.connect().then((socket) => {
      if (cancelled || !socket) return;
      attached = socket;
      socket.emit('duel:join', { duelId });
      socket.on('duel:engine_update', onUpdate);
      socket.on('duel:engine_lost', onLost);
      socket.on('duel:pregame', onPreGame);
      socket.on('duel:finished', onFinished);
    });

    return () => {
      cancelled = true;
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
