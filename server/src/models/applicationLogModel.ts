/**
 * Modèle `application_logs` — table qui alimente la page /admin/logs.
 *
 * Toutes les écritures passent par `services/logSink.ts`, jamais directement.
 * Le sink garantit qu'on ne boucle pas (une insertion qui échoue ne relogue
 * pas via winston), et qu'on émet côté WebSocket dans la foulée pour la vue
 * temps réel.
 */

import { query } from '../config/database';

export type LogLevel = 'error' | 'warn' | 'info';
export type LogSource = 'server' | 'client' | 'crash' | 'http';

export interface ApplicationLogRow {
  id: string; // BIGSERIAL — renvoyé sous forme de string par pg pour éviter tout dépassement JS.
  level: LogLevel;
  source: LogSource;
  message: string;
  stack: string | null;
  url: string | null;
  user_id: number | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface InsertLogInput {
  level: LogLevel;
  source: LogSource;
  message: string;
  stack?: string | null;
  url?: string | null;
  user_id?: number | null;
  meta?: Record<string, unknown> | null;
}

export interface ListLogsOpts {
  level?: LogLevel;
  source?: LogSource;
  sinceId?: string | number;
  limit?: number;
  search?: string;
}

export interface ListLogsResult {
  logs: ApplicationLogRow[];
  total: number;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const MAX_MESSAGE_LEN = 2000;
const MAX_STACK_LEN = 8000;
const MAX_URL_LEN = 500;

/** Neutralise CR/LF (injection de fausses lignes) et tronque à la longueur max. */
function clean(value: string | null | undefined, maxLen: number): string | null {
  if (value == null) return null;
  const s = String(value).replace(/[\r\n]+/g, ' ⏎ ').slice(0, maxLen);
  return s.length === 0 ? null : s;
}

export const ApplicationLogModel = {
  async insert(entry: InsertLogInput): Promise<ApplicationLogRow> {
    const message = clean(entry.message, MAX_MESSAGE_LEN) || '(no message)';
    const stack = clean(entry.stack ?? null, MAX_STACK_LEN);
    const url = clean(entry.url ?? null, MAX_URL_LEN);
    const meta = entry.meta ?? {};

    const result = await query(
      `INSERT INTO application_logs (level, source, message, stack, url, user_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, level, source, message, stack, url, user_id, meta, created_at`,
      [
        entry.level,
        entry.source,
        message,
        stack,
        url,
        entry.user_id ?? null,
        JSON.stringify(meta),
      ]
    );
    return result.rows[0] as ApplicationLogRow;
  },

  async list(opts: ListLogsOpts = {}): Promise<ListLogsResult> {
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (opts.level) {
      conditions.push(`level = $${idx++}`);
      values.push(opts.level);
    }
    if (opts.source) {
      conditions.push(`source = $${idx++}`);
      values.push(opts.source);
    }
    if (opts.sinceId != null) {
      conditions.push(`id > $${idx++}`);
      values.push(String(opts.sinceId));
    }
    if (opts.search && opts.search.trim().length > 0) {
      conditions.push(`(message ILIKE $${idx} OR url ILIKE $${idx})`);
      values.push(`%${opts.search.trim()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM application_logs ${where}`,
      values
    );
    const total = countRes.rows[0]?.n ?? 0;

    values.push(limit);
    const rows = await query(
      `SELECT id, level, source, message, stack, url, user_id, meta, created_at
         FROM application_logs
         ${where}
        ORDER BY id DESC
        LIMIT $${idx}`,
      values
    );

    return { logs: rows.rows as ApplicationLogRow[], total };
  },

  /**
   * Purge des logs > 7 jours. Rétention volontairement courte : la valeur
   * est dans le debug live. Appelée quotidiennement par le cron de index.ts.
   */
  async purgeOld(): Promise<number> {
    const result = await query(
      `DELETE FROM application_logs
        WHERE created_at < NOW() - INTERVAL '7 days'`
    );
    return result.rowCount ?? 0;
  },
};
