import api from './api';
import type { DuelMatch, Duel } from '../../../shared/types';

/**
 * Client pour les matches Bo3 (F4).
 *
 * Un match est un chapeau qui regroupe 1 à 3 duels. La progression suit :
 *   1. `create` — crée le match + son premier duel enfant.
 *   2. Le premier duel se joue comme un duel classique (accept, pré-game, moteur).
 *   3. À la fin de chaque duel gagnant sans finir le match, le match passe en
 *      `sideboard` : les deux joueurs soumettent leur nouvelle composition via
 *      `submitSideDeck`, puis `nextGame` crée la manche suivante.
 */
export const duelMatchApi = {
  create: (payload: {
    opponent_id?: number;
    opponent_username?: string;
    best_of: 1 | 2 | 3;
    challenger_deck_id?: number | null;
  }): Promise<{ match: DuelMatch; firstDuelId: number }> =>
    api.post<{ match: DuelMatch; firstDuelId: number }>('/duels/matches', payload).then((r) => r.data),

  view: (matchId: number): Promise<{ match: DuelMatch; submittedBy: number[] }> =>
    api
      .get<{ match: DuelMatch; submittedBy: number[] }>(`/duels/matches/${matchId}`)
      .then((r) => r.data),

  submitSideDeck: (
    matchId: number,
    payload: { main: number[]; extra: number[]; side: number[] }
  ): Promise<{ submission: unknown }> =>
    api
      .post(`/duels/matches/${matchId}/side-deck/submit`, payload)
      .then((r) => r.data),

  nextGame: (matchId: number): Promise<{ duelId: number; gameNumber: number }> =>
    api
      .post<{ duelId: number; gameNumber: number }>(`/duels/matches/${matchId}/next-game`)
      .then((r) => r.data),
};

export type { Duel };
export default duelMatchApi;
