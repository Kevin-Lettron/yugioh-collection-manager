/**
 * LogSink — point unique d'écriture des logs applicatifs vers la base +
 * broadcast temps réel aux admins connectés via socket.io.
 *
 * Utilisé par :
 *   - le transport winston `DbTransport` (utils/logger.ts) — chaque
 *     `logger.error` / `logger.warn` y arrive automatiquement
 *   - la route POST /api/client-errors — erreurs front (source = 'client')
 *   - les handlers process (uncaughtException / unhandledRejection) qui
 *     forcent source='crash'
 *   - le middleware errorHandler (indirectement via winston -> DbTransport)
 *
 * Points d'attention :
 *   - Un log qui log qui log ferait exploser la table. TOUTES les erreurs de
 *     ce module sont swallowées (console.error uniquement, jamais logger.*).
 *   - Un flag `reentrancyGuard` bloque une écriture depuis DANS une écriture
 *     (winston pourrait rappeler quand `query` échoue via un autre transport
 *     enchaîné). En pratique la DB est isolée du chemin — mais on ceinture.
 */

import type { Server as SocketServer } from 'socket.io';
import {
  ApplicationLogModel,
  type InsertLogInput,
  type ApplicationLogRow,
} from '../models/applicationLogModel';

// io est injecté au boot depuis index.ts. Tant qu'il est nul, on n'émet pas
// (aucun admin n'est encore connecté de toute façon).
let io: SocketServer | null = null;

export function bindSocketServer(server: SocketServer): void {
  io = server;
}

/** Nom de la room où les admins reçoivent le flux live. */
export const ADMIN_LOGS_ROOM = 'admin:logs';

let reentrancyGuard = false;

/**
 * Insertion + broadcast. Ne throw jamais — si l'écriture DB échoue, on avale
 * silencieusement (console.error uniquement) pour ne pas déclencher une
 * cascade de logs sur log.
 */
export async function writeLog(entry: InsertLogInput): Promise<void> {
  if (reentrancyGuard) return;
  reentrancyGuard = true;
  try {
    const row = await ApplicationLogModel.insert(entry);
    if (io) {
      io.to(ADMIN_LOGS_ROOM).emit('admin:log', serializeForClient(row));
    }
  } catch (err) {
    // Interdit d'appeler logger.* ici — sinon boucle. Console brute uniquement.
    // eslint-disable-next-line no-console
    console.error('[logSink] insert failed (swallowed)', err);
  } finally {
    reentrancyGuard = false;
  }
}

/**
 * bigint -> string : pg renvoie déjà BIGSERIAL comme string, on garantit le
 * type côté client. `created_at` est déjà une string ISO.
 */
function serializeForClient(row: ApplicationLogRow) {
  return {
    id: String(row.id),
    level: row.level,
    source: row.source,
    message: row.message,
    stack: row.stack,
    url: row.url,
    user_id: row.user_id,
    meta: row.meta,
    created_at: row.created_at,
  };
}
