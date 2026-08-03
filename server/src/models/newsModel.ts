/**
 * Modèle des actualités — lecture du fil, gestion des abonnements par thème.
 *
 * Deux tables jouent ici : `news_items` (le fil, joint à `news_sources` pour
 * afficher le nom de la source) et `user_news_topics` (les abonnements
 * personnels, qui filtrent le fil quand l'utilisateur est connecté et n'a rien
 * passé en query).
 */

import { getClient, query } from '../config/database';
import type {
  NewsItemRow,
  NewsSourceRow,
  NewsTopic,
} from '../services/news/types';
import { isNewsTopic } from '../services/news/types';

export interface NewsItemWithSource extends NewsItemRow {
  source: Pick<NewsSourceRow, 'key' | 'name' | 'homepage'>;
}

export interface ListItemsOpts {
  topics?: string[];
  page?: number;
  limit?: number;
}

export interface ListItemsResult {
  items: NewsItemWithSource[];
  total: number;
}

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parseRow(row: any): NewsItemWithSource {
  return {
    id: row.id,
    source_id: row.source_id,
    guid: row.guid,
    url: row.url,
    title: row.title,
    summary: row.summary,
    image_url: row.image_url,
    published_at: row.published_at,
    topics: row.topics ?? [],
    lang: row.lang,
    source: {
      key: row.source_key,
      name: row.source_name,
      homepage: row.source_homepage,
    },
  };
}

export const NewsModel = {
  async listItems(opts: ListItemsOpts = {}): Promise<ListItemsResult> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    // Seuls les thèmes typés sont pris en compte — un topic inconnu ne doit
    // pas devenir un filtre silencieusement vide.
    const topics = (opts.topics ?? []).filter(isNewsTopic);

    const params: any[] = [];
    let where = '';
    if (topics.length > 0) {
      params.push(topics);
      where = `WHERE i.topics && $${params.length}::text[]`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS n FROM news_items i ${where}`,
      params
    );
    const total = countResult.rows[0]?.n ?? 0;

    params.push(limit);
    params.push(offset);

    const itemsResult = await query(
      `SELECT i.id, i.source_id, i.guid, i.url, i.title, i.summary,
              i.image_url, i.published_at, i.topics, i.lang,
              s.key AS source_key, s.name AS source_name, s.homepage AS source_homepage
       FROM news_items i
       JOIN news_sources s ON s.id = i.source_id
       ${where}
       ORDER BY i.published_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return {
      items: itemsResult.rows.map(parseRow),
      total,
    };
  },

  async getUserTopics(userId: number): Promise<NewsTopic[]> {
    const result = await query(
      `SELECT topic FROM user_news_topics WHERE user_id = $1`,
      [userId]
    );
    return result.rows
      .map((r) => r.topic)
      .filter(isNewsTopic);
  },

  /**
   * Réécriture atomique des abonnements — DELETE puis INSERT sous transaction,
   * pour qu'on ne se retrouve jamais entre deux avec un utilisateur sans
   * aucun thème visible pendant qu'on ajoute les nouveaux.
   */
  async setUserTopics(userId: number, topics: NewsTopic[]): Promise<void> {
    const unique = Array.from(new Set(topics.filter(isNewsTopic)));

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM user_news_topics WHERE user_id = $1', [userId]);

      if (unique.length > 0) {
        // Insertion en un seul INSERT ... VALUES ($1,$2), ($1,$3), ...
        const values: string[] = [];
        const params: any[] = [userId];
        for (const topic of unique) {
          params.push(topic);
          values.push(`($1, $${params.length})`);
        }
        await client.query(
          `INSERT INTO user_news_topics (user_id, topic) VALUES ${values.join(', ')}`,
          params
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async getSources(): Promise<NewsSourceRow[]> {
    const result = await query(
      `SELECT id, key, name, feed_url, homepage, default_topics,
              requires_topic_match, enabled, min_interval_minutes,
              last_fetch_at, last_success_at, last_error, consecutive_failures
       FROM news_sources
       ORDER BY id`
    );
    return result.rows as NewsSourceRow[];
  },
};
