/**
 * Ingestion des flux — récupération, classification, insertion, télémétrie.
 *
 * Chaque source est traitée seule et en série : les rate-limits d'un flux ne
 * doivent pas empêcher les autres de vivre, et un `Promise.all` sur Reddit
 * plus YGOrganization plus Pojo finirait par se manger un 429. Une pause
 * entre chaque source est la politesse minimum.
 *
 * L'état de santé d'une source est écrit à chaque passage (`last_fetch_at`,
 * `last_success_at`, `last_error`, `consecutive_failures`) : après trois
 * échecs consécutifs, la source est mise en sommeil par le sélecteur.
 */

import { query } from '../../config/database';
import { fetchFeed } from './fetcher';
import { parseFeed } from './parser';
import { classifyArticle } from './classify';
import { translatePendingArticles } from './translate';
import type { NewsSourceRow } from './types';

export interface IngestReport {
  inserted: number;
  skipped: number;
  errors: number;
}

/** Pause entre deux sources — laisse respirer les serveurs distants. */
const DELAY_BETWEEN_SOURCES_MS = 2_000;

/** Trois échecs d'affilée mettent la source en sommeil. */
const SLEEP_THRESHOLD = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Un jour, l'un des flux répondra du HTML au lieu d'un XML : on borne. */
function shortErr(err: unknown, max = 500): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.length <= max ? raw : raw.slice(0, max - 1) + '…';
}

async function markSuccess(sourceId: number): Promise<void> {
  await query(
    `UPDATE news_sources
     SET last_fetch_at = NOW(),
         last_success_at = NOW(),
         last_error = NULL,
         last_error_at = NULL,
         consecutive_failures = 0
     WHERE id = $1`,
    [sourceId]
  );
}

async function markFailure(sourceId: number, message: string): Promise<void> {
  await query(
    `UPDATE news_sources
     SET last_fetch_at = NOW(),
         last_error = $2,
         last_error_at = NOW(),
         consecutive_failures = consecutive_failures + 1
     WHERE id = $1`,
    [sourceId, message]
  );
}

export async function ingestSource(source: NewsSourceRow): Promise<IngestReport> {
  const report: IngestReport = { inserted: 0, skipped: 0, errors: 0 };

  let xml: string;
  try {
    const res = await fetchFeed(source.feed_url);
    xml = res.body;
  } catch (err) {
    report.errors++;
    await markFailure(source.id, shortErr(err));
    console.error(`[news:ingest] ${source.key} fetch KO — ${shortErr(err, 200)}`);
    return report;
  }

  let items;
  try {
    items = parseFeed(xml);
  } catch (err) {
    report.errors++;
    await markFailure(source.id, shortErr(err));
    console.error(`[news:ingest] ${source.key} parse KO — ${shortErr(err, 200)}`);
    return report;
  }

  for (const raw of items) {
    try {
      const topics = classifyArticle(raw, source);
      if (topics.length === 0) {
        report.skipped++;
        continue;
      }

      const result = await query(
        `INSERT INTO news_items (source_id, guid, url, title, summary, image_url, published_at, topics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (source_id, guid) DO NOTHING
         RETURNING id`,
        [
          source.id,
          raw.guid,
          raw.url,
          raw.title,
          raw.summary,
          raw.imageUrl,
          raw.publishedAt,
          topics,
        ]
      );

      if (result.rowCount && result.rowCount > 0) {
        report.inserted++;
      } else {
        report.skipped++;
      }
    } catch (err) {
      report.errors++;
      console.error(`[news:ingest] ${source.key} item KO — ${shortErr(err, 200)}`);
    }
  }

  // Le succès s'écrit même quand tout est déjà connu : ce qui compte c'est
  // que la source a répondu et qu'on a su la lire.
  await markSuccess(source.id);

  return report;
}

/**
 * Sélectionne les sources à interroger et les traite en série.
 *
 * Filtres :
 *   - enabled = true
 *   - consecutive_failures < 3 (les autres sont en sommeil, réactivées à la
 *     main via UPDATE ... SET consecutive_failures = 0)
 *   - jamais interrogée, OU l'intervalle minimal est écoulé
 */
export async function ingestAllSources(): Promise<Record<string, IngestReport>> {
  const result = await query(
    `SELECT * FROM news_sources
     WHERE enabled = TRUE
       AND consecutive_failures < $1
       AND (last_fetch_at IS NULL
            OR last_fetch_at < NOW() - (min_interval_minutes * INTERVAL '1 minute'))
     ORDER BY id`,
    [SLEEP_THRESHOLD]
  );

  const sources: NewsSourceRow[] = result.rows;
  const bilan: Record<string, IngestReport> = {};

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    console.log(`[news:ingest] → ${source.key}`);
    const report = await ingestSource(source);
    bilan[source.key] = report;
    console.log(
      `[news:ingest]   ${source.key} : ${report.inserted} nouveau(x), ${report.skipped} déjà connu(s), ${report.errors} erreur(s)`
    );
    // Pause entre chaque source (sauf après la dernière) pour éviter les 429.
    if (i < sources.length - 1) await delay(DELAY_BETWEEN_SOURCES_MS);
  }

  // Traduction FR des nouveaux articles (best-effort, ne bloque pas l'ingest si echec).
  // On limite a 40 par cycle pour capper le cout Claude et laisser le backfill respirer.
  try {
    const trad = await translatePendingArticles(40);
    console.log(`[news:translate] ${trad.ok} traduit(s), ${trad.ko} echec(s)`);
  } catch (err) {
    console.error('[news:translate] batch failed', err);
  }

  return bilan;
}

/**
 * Supprime les articles plus vieux que 6 mois — retenir plus n'a pas de sens
 * pour un fil d'actualité, et la table gonflerait sans utilité.
 */
export async function purgeOldItems(): Promise<number> {
  const result = await query(
    `DELETE FROM news_items
     WHERE published_at < NOW() - INTERVAL '6 months'
     RETURNING id`
  );
  return result.rowCount ?? 0;
}
