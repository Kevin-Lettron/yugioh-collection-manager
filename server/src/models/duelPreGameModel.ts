import { query } from '../config/database';
import type { Duel } from '../../../shared/types';
import type { DuelPreGameState } from '../../../shared/duelView';

/**
 * Pile ou face + choix du premier joueur, avant le lancement effectif du moteur.
 *
 * La règle officielle YGO : le gagnant du pile ou face choisit qui commence
 * (P1 ou P2). Le mode manuel ignorait ça, le moteur aussi jusqu'à cette
 * migration ; le siège 0 (challenger) démarrait toujours.
 *
 * Le déroulé est en trois temps :
 *   1. `awaiting_flip`  — les deux joueurs cliquent chacun leur tour. Au
 *      second clic, le serveur tire le vainqueur (RNG) et passe à…
 *   2. `awaiting_choice` — seul le gagnant peut appeler
 *      `first-player-choice` avec 'P1' ou 'P2'. Un compte à rebours de 30 s
 *      démarre côté client ; passé ce délai le front envoie 'P1'
 *      automatiquement pour ne pas geler la partie.
 *   3. `resolved` — `first_player_id` est posé, le moteur peut être lancé.
 *
 * Aucun tirage n'est fait côté client : sinon un joueur mal intentionné
 * pourrait annoncer une victoire non arbitrée.
 */

/**
 * Ensemble « qui a cliqué le bouton pile ou face », stocké **en mémoire**.
 *
 * En base, on ne pose que le résultat final (gagnant, choix). Le compteur des
 * clics est éphémère : il ne survit pas à un redémarrage, mais un redémarrage
 * en plein pile-ou-face est un cas où on préfère de toute façon relancer
 * proprement plutôt que de deviner l'état.
 */
const clicks = new Map<number, Set<number>>();

/** Nettoie l'ensemble local — appelé quand la phase transite. */
function clearClicks(duelId: number): void {
  clicks.delete(duelId);
}

/** Timestamp d'entrée en `awaiting_choice`, pour piloter le compte à rebours. */
const choiceDeadlines = new Map<number, number>();
const CHOICE_DEADLINE_MS = 30_000;

export class DuelPreGameModel {
  /**
   * Fait entrer un duel accepté en phase pré-game.
   *
   * Refuse si le duel n'est pas en `pending` (déjà démarré ou terminé). Cet
   * appel remplace l'ancienne transition directe vers `active` pour les duels
   * joués au moteur.
   */
  static async begin(duelId: number): Promise<void> {
    // Récupère les 2 IDs pour tirer le winner immédiatement (pas de bouton
    // à cliquer côté client — l'user a demandé un flow direct : on ouvre le
    // duel, la pièce tombe, le vainqueur choisit qui commence).
    const meta = await query(
      `SELECT challenger_id, opponent_id FROM duels WHERE id = $1`,
      [duelId]
    );
    const row = meta.rows[0];
    if (!row) return;
    const winnerId: number = Math.random() < 0.5 ? row.challenger_id : row.opponent_id;

    await query(
      `UPDATE duels
          SET status = 'pre_game',
              phase_pre_game = 'awaiting_choice',
              coin_flip_winner_id = $2,
              coin_flip_choice = NULL,
              first_player_id = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status IN ('pending', 'active')`,
      [duelId, winnerId]
    );
    clearClicks(duelId);
    choiceDeadlines.set(duelId, Date.now() + CHOICE_DEADLINE_MS);
  }

  /**
   * Un joueur clique le bouton « pile ou face ».
   *
   * Retourne l'état résultant. Quand les deux joueurs ont cliqué, on tire le
   * gagnant côté serveur et on passe en `awaiting_choice`.
   */
  static async recordFlipClick(duel: Duel, userId: number): Promise<DuelPreGameState> {
    if (duel.status !== 'pre_game' || duel.phase_pre_game !== 'awaiting_flip') {
      return this.snapshot(duel);
    }

    let set = clicks.get(duel.id);
    if (!set) {
      set = new Set();
      clicks.set(duel.id, set);
    }
    set.add(userId);

    // Les deux joueurs ont participé : le RNG serveur choisit.
    if (set.has(duel.challenger_id) && set.has(duel.opponent_id)) {
      const winnerId = Math.random() < 0.5 ? duel.challenger_id : duel.opponent_id;
      await query(
        `UPDATE duels
            SET phase_pre_game = 'awaiting_choice',
                coin_flip_winner_id = $1,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND status = 'pre_game' AND phase_pre_game = 'awaiting_flip'`,
        [winnerId, duel.id]
      );
      choiceDeadlines.set(duel.id, Date.now() + CHOICE_DEADLINE_MS);
      clearClicks(duel.id);
      const refreshed = await this.readDuel(duel.id);
      if (refreshed) return this.snapshot(refreshed);
    }

    return this.snapshot(duel);
  }

  /**
   * Le gagnant du pile ou face choisit P1 (jouer en 1er) ou P2 (jouer en 2nd).
   *
   * Refuse si l'appelant n'est pas le gagnant, ou si la phase n'est pas
   * `awaiting_choice`. Le fallback (choix automatique après 30 s) passe par
   * `resolveChoiceIfExpired` ci-dessous.
   */
  static async recordChoice(
    duel: Duel,
    userId: number,
    choice: 'P1' | 'P2'
  ): Promise<DuelPreGameState> {
    if (duel.status !== 'pre_game' || duel.phase_pre_game !== 'awaiting_choice') {
      return this.snapshot(duel);
    }
    if (duel.coin_flip_winner_id !== userId) {
      throw new Error("Seul le vainqueur du pile ou face peut choisir");
    }

    // 'P1' = le vainqueur joue en 1er ; 'P2' = le perdant joue en 1er.
    const firstPlayerId =
      choice === 'P1'
        ? userId
        : userId === duel.challenger_id
          ? duel.opponent_id
          : duel.challenger_id;

    await query(
      `UPDATE duels
          SET phase_pre_game = 'resolved',
              coin_flip_choice = $1,
              first_player_id = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND status = 'pre_game' AND phase_pre_game = 'awaiting_choice'`,
      [choice, firstPlayerId, duel.id]
    );

    choiceDeadlines.delete(duel.id);
    const refreshed = await this.readDuel(duel.id);
    return refreshed ? this.snapshot(refreshed) : this.snapshot(duel);
  }

  /**
   * Si le vainqueur n'a pas choisi dans les 30 s, on résout à sa place avec
   * 'P1' — même comportement qu'EDOPro. Sans cela un joueur peut geler la
   * partie avant qu'elle ne commence.
   */
  static async resolveChoiceIfExpired(duel: Duel): Promise<DuelPreGameState | null> {
    if (duel.status !== 'pre_game' || duel.phase_pre_game !== 'awaiting_choice') {
      return null;
    }
    const deadline = choiceDeadlines.get(duel.id);
    if (!deadline || Date.now() < deadline) return null;
    if (!duel.coin_flip_winner_id) return null;

    return this.recordChoice(duel, duel.coin_flip_winner_id, 'P1');
  }

  /** Vue exportable de l'état pré-game pour le front. */
  static snapshot(duel: Duel): DuelPreGameState {
    const set = clicks.get(duel.id);
    const playersReady: number[] = set ? [...set] : [];
    const deadline = choiceDeadlines.get(duel.id) ?? null;
    return {
      phase: (duel.phase_pre_game as any) ?? 'awaiting_flip',
      playersReady,
      winnerId: duel.coin_flip_winner_id ?? null,
      choice: (duel.coin_flip_choice as 'P1' | 'P2' | null) ?? null,
      firstPlayerId: duel.first_player_id ?? null,
      choiceDeadlineAt: deadline,
    };
  }

  /** Petit helper : relit le duel après une écriture. */
  private static async readDuel(duelId: number): Promise<Duel | null> {
    const { DuelModel } = await import('./duelModel');
    return DuelModel.findById(duelId);
  }
}
