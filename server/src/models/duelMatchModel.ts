import { query } from '../config/database';

/**
 * Match Bo1 / Bo2 / Bo3 — regroupe 1 à 3 duels et suit le score.
 *
 * Un match est le format « officiel » YGO : chaque partie individuelle est un
 * duel de la table `duels`, rattaché via `match_id`. Entre deux manches, chaque
 * joueur peut échanger jusqu'à 15 cartes entre son Main Deck et son Side Deck ;
 * la composition retenue pour la manche suivante vit dans `duel_side_decks`.
 *
 * Cycle de vie :
 *   pending    – match créé, aucune manche encore lancée
 *   active     – la manche en cours (dernière ligne de `duels` avec match_id)
 *                est active
 *   sideboard  – une manche vient de se terminer, on attend les deux side decks
 *   finished   – un joueur a atteint `wins_needed()`, ou le match a été annulé
 *   cancelled  – annulation manuelle
 */

export type DuelMatchStatus =
  | 'pending'
  | 'active'
  | 'sideboard'
  | 'finished'
  | 'cancelled';

export interface DuelMatch {
  id: number;
  challenger_id: number;
  opponent_id: number;
  best_of: 1 | 2 | 3;
  status: DuelMatchStatus;
  challenger_wins: number;
  opponent_wins: number;
  winner_id: number | null;
  created_at: Date;
  finished_at: Date | null;
}

function rowToMatch(row: any): DuelMatch {
  return {
    id: row.id,
    challenger_id: row.challenger_id,
    opponent_id: row.opponent_id,
    best_of: row.best_of as 1 | 2 | 3,
    status: row.status as DuelMatchStatus,
    challenger_wins: row.challenger_wins,
    opponent_wins: row.opponent_wins,
    winner_id: row.winner_id ?? null,
    created_at: row.created_at,
    finished_at: row.finished_at ?? null,
  };
}

/**
 * Nombre de victoires nécessaires pour terminer le match.
 *
 * Bo3 → 2 victoires, Bo1 → 1. On garde la formule explicite ici : ailleurs on
 * ne raisonne qu'en score courant, jamais en « best_of / 2 + 1 ».
 */
export function winsNeeded(bestOf: 1 | 2 | 3): number {
  return bestOf === 1 ? 1 : 2;
}

export class DuelMatchModel {
  static async create(
    challengerId: number,
    opponentId: number,
    bestOf: 1 | 2 | 3
  ): Promise<DuelMatch> {
    const res = await query(
      `INSERT INTO duel_matches (challenger_id, opponent_id, best_of, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [challengerId, opponentId, bestOf]
    );
    return rowToMatch(res.rows[0]);
  }

  static async findById(id: number): Promise<DuelMatch | null> {
    const res = await query('SELECT * FROM duel_matches WHERE id = $1', [id]);
    return res.rows[0] ? rowToMatch(res.rows[0]) : null;
  }

  /** Liste les duels d'un match, dans l'ordre des manches. */
  static async listGames(matchId: number): Promise<Array<{ id: number; game_number: number; status: string; winner_id: number | null }>> {
    const res = await query(
      `SELECT id, game_number, status, winner_id
         FROM duels
        WHERE match_id = $1
        ORDER BY game_number`,
      [matchId]
    );
    return res.rows.map((r) => ({
      id: r.id,
      game_number: r.game_number,
      status: r.status,
      winner_id: r.winner_id ?? null,
    }));
  }

  /** Marque le match `active` — appelé au start du premier duel enfant. */
  static async setActive(id: number): Promise<void> {
    await query(
      `UPDATE duel_matches SET status = 'active' WHERE id = $1 AND status = 'pending'`,
      [id]
    );
  }

  /**
   * Enregistre la victoire d'un joueur sur une manche.
   *
   * Effet de bord : selon le score, passe le match en `sideboard` (partie
   * suivante attendue) ou `finished` (score cible atteint).
   * Retourne le match rafraîchi.
   */
  static async recordGameWin(matchId: number, winnerId: number): Promise<DuelMatch | null> {
    const match = await this.findById(matchId);
    if (!match) return null;
    if (match.status === 'finished' || match.status === 'cancelled') return match;

    const isChallenger = winnerId === match.challenger_id;
    const isOpponent = winnerId === match.opponent_id;
    if (!isChallenger && !isOpponent) return match;

    const nextChallengerWins = match.challenger_wins + (isChallenger ? 1 : 0);
    const nextOpponentWins = match.opponent_wins + (isOpponent ? 1 : 0);
    const target = winsNeeded(match.best_of);

    if (nextChallengerWins >= target || nextOpponentWins >= target) {
      // Match terminé, on fige gagnant + timestamp.
      await query(
        `UPDATE duel_matches
            SET challenger_wins = $1,
                opponent_wins = $2,
                winner_id = $3,
                status = 'finished',
                finished_at = CURRENT_TIMESTAMP
          WHERE id = $4`,
        [nextChallengerWins, nextOpponentWins, winnerId, matchId]
      );
    } else {
      // Encore une manche à jouer — on entre en phase sideboard.
      await query(
        `UPDATE duel_matches
            SET challenger_wins = $1,
                opponent_wins = $2,
                status = 'sideboard'
          WHERE id = $3`,
        [nextChallengerWins, nextOpponentWins, matchId]
      );
    }
    return this.findById(matchId);
  }

  /** Repasse le match en `active` — appelé quand la manche suivante démarre. */
  static async setActiveNextGame(matchId: number): Promise<void> {
    await query(
      `UPDATE duel_matches
          SET status = 'active'
        WHERE id = $1 AND status = 'sideboard'`,
      [matchId]
    );
  }

  static async cancel(id: number): Promise<void> {
    await query(
      `UPDATE duel_matches
          SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status NOT IN ('finished', 'cancelled')`,
      [id]
    );
  }
}
