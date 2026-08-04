import { query } from '../config/database';
import type { DuelChoice, DuelSeat } from '../../../shared/duelView';

/**
 * Persistance du mode moteur.
 *
 * On ne sauvegarde **pas** l'état de la partie : ygopro-core n'expose aucune
 * sérialisation d'un duel en cours, c'est une limite du moteur et non un
 * raccourci de notre part. On sauvegarde de quoi le **reconstruire** — la
 * graine du mélange et la suite exacte des décisions.
 *
 * Le moteur étant déterministe, même graine + mêmes décisions dans le même
 * ordre = même partie. Cela sert dès aujourd'hui au journal et à l'analyse
 * d'une partie finie ; cela rendra possible, plus tard, la reprise après un
 * redémarrage sans rien changer au format stocké.
 */
export class DuelEngineModel {
  /** Marque le duel comme joué par le moteur et fige sa graine. */
  static async markEngineDuel(duelId: number, seed: readonly bigint[]): Promise<void> {
    await query(
      `UPDATE duels
          SET engine_mode = TRUE,
              engine_seed = $1,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $2`,
      // Sérialisée en texte : PostgreSQL n'a pas d'entier non signé sur
      // 64 bits, et un arrondi ici rendrait la partie non rejouable.
      [seed.map((s) => s.toString()).join(','), duelId]
    );
    // Repartir de zéro : relancer un duel invalide le journal précédent.
    await query('DELETE FROM duel_engine_actions WHERE duel_id = $1', [duelId]);
  }

  static async readSeed(duelId: number): Promise<bigint[] | null> {
    const res = await query(
      'SELECT engine_seed FROM duels WHERE id = $1',
      [duelId]
    );
    const raw = res.rows[0]?.engine_seed as string | null | undefined;
    if (!raw) return null;
    try {
      return raw.split(',').map((s: string) => BigInt(s));
    } catch {
      return null;
    }
  }

  /**
   * Ajoute une décision au journal.
   *
   * Le numéro d'ordre est calculé en base et non côté serveur : deux requêtes
   * concurrentes — les deux joueurs qui répondent en même temps — se
   * verraient sinon attribuer le même rang, et le journal deviendrait
   * inexploitable pour le rejeu.
   */
  static async appendAction(
    duelId: number,
    seat: DuelSeat,
    choice: DuelChoice
  ): Promise<number> {
    const res = await query(
      `INSERT INTO duel_engine_actions (duel_id, seq, seat, option_ids, cancel)
       SELECT $1,
              COALESCE(MAX(seq), 0) + 1,
              $2,
              $3::text[],
              $4
         FROM duel_engine_actions
        WHERE duel_id = $1
       RETURNING seq`,
      [duelId, seat, choice.optionIds ?? [], choice.cancel === true]
    );
    return res.rows[0]?.seq ?? 0;
  }

  static async readActions(
    duelId: number
  ): Promise<Array<{ seq: number; seat: DuelSeat; choice: DuelChoice }>> {
    const res = await query(
      `SELECT seq, seat, option_ids, cancel
         FROM duel_engine_actions
        WHERE duel_id = $1
        ORDER BY seq`,
      [duelId]
    );
    return res.rows.map((r) => ({
      seq: r.seq,
      seat: (r.seat === 1 ? 1 : 0) as DuelSeat,
      choice: { optionIds: r.option_ids ?? [], cancel: r.cancel },
    }));
  }

  static async countActions(duelId: number): Promise<number> {
    const res = await query(
      'SELECT COUNT(*) AS n FROM duel_engine_actions WHERE duel_id = $1',
      [duelId]
    );
    return Number(res.rows[0]?.n ?? 0);
  }

  /**
   * Annule des duels dont le moteur ne connaît plus l'état.
   *
   * Deux cas : le worker est mort, ou le duel a été purgé faute d'activité.
   * Dans les deux cas la partie est perdue — **sans défaite pour personne**.
   * Attribuer la victoire à l'adversaire serait injuste : le duel s'arrête
   * pour une raison technique, pas parce qu'un joueur a abandonné.
   */
  static async cancelLostDuels(duelIds: number[]): Promise<number> {
    if (!duelIds.length) return 0;
    const res = await query(
      `UPDATE duels
          SET status = 'cancelled',
              finished_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($1::int[])
          AND status = 'active'
          AND engine_mode = TRUE`,
      [duelIds]
    );
    return res.rowCount ?? 0;
  }
}
