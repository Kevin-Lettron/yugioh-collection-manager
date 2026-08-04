import { query } from '../config/database';

/**
 * Side deck soumis pour une manche du match.
 *
 * Une soumission = un utilisateur + une manche (2 ou 3). Elle liste la
 * composition retenue : `main_cards`, `extra_cards`, `side_cards` sont des
 * tableaux de `cards.id` (clé interne du catalogue). Le contrôle de format
 * (40 ≤ main ≤ 60, extra ≤ 15, side ≤ 15, banlist) vit dans le contrôleur.
 *
 * On ne persiste pas de « delta » vs. la manche précédente : c'est bien plus
 * simple de raisonner sur la composition complète, et le journal du match
 * permet de comparer si besoin.
 */

export interface DuelSideDeckSubmission {
  id: number;
  duel_match_id: number;
  user_id: number;
  game_number: 2 | 3;
  main_cards: number[];
  extra_cards: number[];
  side_cards: number[];
  submitted_at: Date;
}

function rowToSubmission(row: any): DuelSideDeckSubmission {
  return {
    id: row.id,
    duel_match_id: row.duel_match_id,
    user_id: row.user_id,
    game_number: row.game_number as 2 | 3,
    main_cards: Array.isArray(row.main_cards) ? row.main_cards : [],
    extra_cards: Array.isArray(row.extra_cards) ? row.extra_cards : [],
    side_cards: Array.isArray(row.side_cards) ? row.side_cards : [],
    submitted_at: row.submitted_at,
  };
}

export class DuelSideDeckModel {
  /** Écrit ou remplace une soumission (idempotent — l'unique key est (match, user, game)). */
  static async submit(
    matchId: number,
    userId: number,
    gameNumber: 2 | 3,
    main: number[],
    extra: number[],
    side: number[]
  ): Promise<DuelSideDeckSubmission> {
    const res = await query(
      `INSERT INTO duel_side_decks
         (duel_match_id, user_id, game_number, main_cards, extra_cards, side_cards)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
       ON CONFLICT (duel_match_id, user_id, game_number)
       DO UPDATE SET
         main_cards = EXCLUDED.main_cards,
         extra_cards = EXCLUDED.extra_cards,
         side_cards = EXCLUDED.side_cards,
         submitted_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        matchId,
        userId,
        gameNumber,
        JSON.stringify(main),
        JSON.stringify(extra),
        JSON.stringify(side),
      ]
    );
    return rowToSubmission(res.rows[0]);
  }

  /** Récupère les soumissions d'un match pour une manche donnée (0, 1 ou 2 lignes). */
  static async listForGame(
    matchId: number,
    gameNumber: 2 | 3
  ): Promise<DuelSideDeckSubmission[]> {
    const res = await query(
      `SELECT * FROM duel_side_decks
        WHERE duel_match_id = $1 AND game_number = $2`,
      [matchId, gameNumber]
    );
    return res.rows.map(rowToSubmission);
  }

  static async findForUser(
    matchId: number,
    userId: number,
    gameNumber: 2 | 3
  ): Promise<DuelSideDeckSubmission | null> {
    const res = await query(
      `SELECT * FROM duel_side_decks
        WHERE duel_match_id = $1 AND user_id = $2 AND game_number = $3`,
      [matchId, userId, gameNumber]
    );
    return res.rows[0] ? rowToSubmission(res.rows[0]) : null;
  }
}
