import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { query } from '../config/database';

/**
 * Met à jour `users.last_seen = NOW()` pour l'user authentifié.
 *
 * Pilotage : un cache mémoire par userId qui garde la trace du dernier update.
 * Si le dernier update remonte à moins de {@link TOUCH_INTERVAL_MS}, on saute
 * l'écriture — sinon un utilisateur actif déclencherait un UPDATE à chaque
 * requête (polling toutes les 3 s sur EngineDuelRoom, sondage 2 s pour le
 * chat, etc.), et la DB écrirait 20 lignes / seconde par user en ligne.
 *
 * Le middleware est **best-effort** : on ne renvoie jamais d'erreur au client
 * si l'UPDATE échoue (transient DB). La conséquence maximale d'une écriture
 * ratée = un badge "en ligne" qui s'éteint 2 min plus tôt.
 *
 * Doit être monté APRÈS `authenticateToken` : sans `req.user`, il ne fait rien.
 */

const TOUCH_INTERVAL_MS = 30_000;

/** Dernière écriture connue par userId. Purge implicite : reset au reboot. */
const lastTouchByUser = new Map<number, number>();

export function touchLastSeen(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  // Pas d'auth = pas de last_seen à toucher.
  if (!req.user?.id) {
    next();
    return;
  }
  const userId = req.user.id;
  const now = Date.now();
  const last = lastTouchByUser.get(userId) ?? 0;

  // Toujours enchaîner immédiatement : on n'attend pas la DB pour répondre.
  next();

  if (now - last < TOUCH_INTERVAL_MS) return;
  lastTouchByUser.set(userId, now);

  // Fire-and-forget. Aucune erreur DB ne doit remonter au client — c'est un
  // side-effect purement analytique.
  query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]).catch(() => {
    // Rollback du cache pour qu'un retry passe la prochaine fois.
    lastTouchByUser.delete(userId);
  });
}

/** Utilitaire tests — repart d'un cache vierge. */
export function _resetTouchLastSeenCache(): void {
  lastTouchByUser.clear();
}
