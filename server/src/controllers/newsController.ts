/**
 * Contrôleur Actualités — fil, thèmes, abonnements, sorties, refresh.
 *
 * Le fil suit une règle simple, dans cet ordre :
 *   1. `?topics=...` dans la query → filtre explicite ;
 *   2. utilisateur connecté avec abonnements → filtre sur ses thèmes ;
 *   3. sinon → tout, par ordre chronologique.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError } from '../middleware/errorHandler';
import { NewsModel } from '../models/newsModel';
import {
  NEWS_TOPICS,
  NEWS_TOPIC_LABELS,
  NEWS_TOPIC_DESCRIPTIONS,
  isNewsTopic,
} from '../services/news/types';
import type { NewsTopic } from '../services/news/types';
import { getRecentReleases, getUpcomingReleases } from '../services/news/releases';
import { ingestAllSources } from '../services/news/ingest';

function parseTopicsParam(raw: unknown): NewsTopic[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(isNewsTopic);
}

function parseIntSafe(raw: unknown, fallback: number, min = 1, max = 500): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export class NewsController {
  /**
   * GET /api/news?topics=tcg,banlist&page=1&limit=30
   * Auth optionnelle.
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const queryTopics = parseTopicsParam(req.query.topics);
      const page = parseIntSafe(req.query.page, 1, 1);
      const limit = parseIntSafe(req.query.limit, 30, 1, 100);

      let topics: NewsTopic[] = queryTopics;

      // Pas de filtre explicite : si un utilisateur connecté a des thèmes,
      // on filtre implicitement — sinon on renvoie tout.
      if (topics.length === 0 && req.user) {
        const subs = await NewsModel.getUserTopics(req.user.id);
        if (subs.length > 0) topics = subs;
      }

      const result = await NewsModel.listItems({ topics, page, limit });
      res.json({
        items: result.items,
        total: result.total,
        page,
        limit,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/news/topics
   * Auth optionnelle — l'état `subscribed` reflète le compte connecté (ou false).
   */
  static async listTopics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const subscribed = new Set<NewsTopic>();
      if (req.user) {
        const subs = await NewsModel.getUserTopics(req.user.id);
        for (const t of subs) subscribed.add(t);
      }

      const topics = NEWS_TOPICS.map((key) => ({
        key,
        label: NEWS_TOPIC_LABELS[key],
        description: NEWS_TOPIC_DESCRIPTIONS[key],
        subscribed: subscribed.has(key),
      }));

      res.json({ topics });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/news/topics
   * Body: { topics: string[] } — les thèmes inconnus sont ignorés silencieusement.
   */
  static async updateTopics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Authentification requise');

      const raw = req.body?.topics;
      if (!Array.isArray(raw)) {
        throw new ValidationError('Le champ « topics » doit être un tableau.');
      }

      const valid = raw.filter(isNewsTopic);
      await NewsModel.setUserTopics(req.user.id, valid);

      // Renvoie la même charge que GET /topics, pour que le client puisse
      // rafraîchir son état d'un seul coup.
      const subscribed = new Set(valid);
      const topics = NEWS_TOPICS.map((key) => ({
        key,
        label: NEWS_TOPIC_LABELS[key],
        description: NEWS_TOPIC_DESCRIPTIONS[key],
        subscribed: subscribed.has(key),
      }));

      res.json({ topics });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/news/releases?window=upcoming|recent&days=90
   * Auth optionnelle.
   */
  static async releases(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const window = req.query.window === 'recent' ? 'recent' : 'upcoming';
      const defaultDays = window === 'recent' ? 30 : 90;
      const days = parseIntSafe(req.query.days, defaultDays, 1, 365);

      const releases = window === 'recent'
        ? await getRecentReleases(days)
        : await getUpcomingReleases(days);

      res.json({ releases });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/news/refresh
   * Réservé aux admins/modérateurs — le middleware `requireAdmin` s'en occupe
   * côté route. Ici on se contente de déclencher.
   */
  static async refresh(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bilan = await ingestAllSources();
      res.json({ ok: true, bilan });
    } catch (err) {
      next(err);
    }
  }
}
