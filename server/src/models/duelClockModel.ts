import { query } from '../config/database';
import type { Duel } from '../../../shared/types';
import type { DuelClocks, DuelSeat } from '../../../shared/duelView';

/**
 * Chess-clock des duels moteur.
 *
 * Chaque joueur a un budget total (25 min par défaut) qui décompte **uniquement**
 * quand c'est son tour ou qu'il doit répondre à un prompt. La vérité est côté
 * serveur : `clock_started_at` est le timestamp de la dernière reprise, et
 * `clock_running_for` désigne le user_id dont le chrono tourne. À chaque coup
 * accepté on solde le temps écoulé dans `p1/p2_clock_ms` et on relance pour
 * l'autre siège.
 *
 * Le front affiche une seconde qui tourne en temps réel via `setInterval`, mais
 * il recale sa valeur sur chaque snapshot (poll toutes les 3 s) — sans cette
 * dérive contrôlée, deux navigateurs sur la même partie verraient des chronos
 * qui divergent d'une seconde chaque minute.
 */

/**
 * Snapshot des chronos, positions en millisecondes.
 *
 * `runningForUserId` sert à imputer le décompte au bon siège dans le front,
 * qui traduit ensuite via `seatOf(duel, userId)`.
 */
export interface ClockSnapshot {
  p1Ms: number;
  p2Ms: number;
  runningForUserId: number | null;
  serverNow: number;
}

/** Retourne les chronos courants sans écrire — usage `view`. */
export function computeClocks(duel: Duel): ClockSnapshot {
  const now = Date.now();
  let p1 = duel.p1_clock_ms ?? 1500000;
  let p2 = duel.p2_clock_ms ?? 1500000;
  const running = duel.clock_running_for ?? null;
  const startedAt = duel.clock_started_at ? new Date(duel.clock_started_at).getTime() : null;

  if (running && startedAt) {
    const elapsed = Math.max(0, now - startedAt);
    if (running === duel.challenger_id) p1 = Math.max(0, p1 - elapsed);
    else if (running === duel.opponent_id) p2 = Math.max(0, p2 - elapsed);
  }

  return { p1Ms: p1, p2Ms: p2, runningForUserId: running, serverNow: now };
}

/** Traduit le snapshot en `DuelClocks` du point de vue d'un siège donné. */
export function clocksForSeat(duel: Duel, seat: DuelSeat, snap: ClockSnapshot): DuelClocks {
  let runningFor: DuelSeat | null = null;
  if (snap.runningForUserId === duel.challenger_id) {
    runningFor = seatForChallenger(duel);
  } else if (snap.runningForUserId === duel.opponent_id) {
    runningFor = seatForOpponent(duel);
  }
  // On expose p1/p2 côté siège perçu : `p1Ms` = « mon chrono », `p2Ms` = adversaire.
  const myUserId = seat === seatForChallenger(duel) ? duel.challenger_id : duel.opponent_id;
  const myMs = myUserId === duel.challenger_id ? snap.p1Ms : snap.p2Ms;
  const oppMs = myUserId === duel.challenger_id ? snap.p2Ms : snap.p1Ms;
  return {
    p1Ms: myMs,
    p2Ms: oppMs,
    runningFor,
    serverNow: snap.serverNow,
  };
}

/**
 * Siège du challenger — 0 tant qu'aucun pile ou face n'a inversé les rôles.
 *
 * Une fois que `first_player_id` est posé, le siège 0 revient à celui qui joue
 * en 1er, pour que le moteur n'ait pas besoin de savoir qui est challenger.
 */
export function seatForChallenger(duel: Duel): DuelSeat {
  if (!duel.first_player_id) return 0;
  return duel.first_player_id === duel.challenger_id ? 0 : 1;
}

export function seatForOpponent(duel: Duel): DuelSeat {
  return seatForChallenger(duel) === 0 ? 1 : 0;
}

export class DuelClockModel {
  /**
   * Démarre le décompte pour un joueur donné.
   *
   * Idempotent : rappeler avec le même utilisateur ne fait rien. Basculer d'un
   * joueur à l'autre solde d'abord le temps du précédent — le calcul est fait
   * en base pour éviter la fenêtre où deux appels consécutifs se chevauchent.
   */
  static async startFor(duelId: number, userId: number): Promise<void> {
    // Solde le temps du joueur en cours (si différent), puis pose le nouveau.
    await query(
      `UPDATE duels
          SET p1_clock_ms = CASE
                WHEN clock_running_for = challenger_id AND clock_started_at IS NOT NULL
                THEN GREATEST(0, p1_clock_ms - (EXTRACT(EPOCH FROM (NOW() - clock_started_at)) * 1000)::INT)
                ELSE p1_clock_ms
              END,
              p2_clock_ms = CASE
                WHEN clock_running_for = opponent_id AND clock_started_at IS NOT NULL
                THEN GREATEST(0, p2_clock_ms - (EXTRACT(EPOCH FROM (NOW() - clock_started_at)) * 1000)::INT)
                ELSE p2_clock_ms
              END,
              clock_running_for = $1,
              clock_started_at = NOW()
        WHERE id = $2 AND status IN ('active', 'pre_game')`,
      [userId, duelId]
    );
  }

  /**
   * Arrête complètement le décompte (fin de partie, abandon).
   *
   * Solde le temps du dernier joueur en course puis met `clock_running_for` à
   * NULL. Après cet appel, le chrono ne bouge plus.
   */
  static async stop(duelId: number): Promise<void> {
    await query(
      `UPDATE duels
          SET p1_clock_ms = CASE
                WHEN clock_running_for = challenger_id AND clock_started_at IS NOT NULL
                THEN GREATEST(0, p1_clock_ms - (EXTRACT(EPOCH FROM (NOW() - clock_started_at)) * 1000)::INT)
                ELSE p1_clock_ms
              END,
              p2_clock_ms = CASE
                WHEN clock_running_for = opponent_id AND clock_started_at IS NOT NULL
                THEN GREATEST(0, p2_clock_ms - (EXTRACT(EPOCH FROM (NOW() - clock_started_at)) * 1000)::INT)
                ELSE p2_clock_ms
              END,
              clock_running_for = NULL,
              clock_started_at = NULL
        WHERE id = $1`,
      [duelId]
    );
  }

  /**
   * Vrai si un chrono a atteint 0 — l'appelant tranche la perte auto.
   *
   * Renvoie l'ID du joueur qui a perdu à zéro, ou `null` sinon. On ne fait
   * pas le `DuelModel.finish` ici pour ne pas mélanger cycle de vie et
   * comptabilité du temps.
   */
  static loserOnZero(duel: Duel): number | null {
    const snap = computeClocks(duel);
    if (snap.p1Ms <= 0) return duel.challenger_id;
    if (snap.p2Ms <= 0) return duel.opponent_id;
    return null;
  }
}
