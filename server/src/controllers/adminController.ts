import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { query } from '../config/database';
import { UserRole } from '../../../shared/types';
import logger from '../utils/logger';
import {
  ApplicationLogModel,
  type LogLevel,
  type LogSource,
} from '../models/applicationLogModel';

const VALID_ROLES: UserRole[] = ['user', 'moderator', 'admin'];

/**
 * Utility to log admin actions for audit trail.
 * All destructive actions go through this.
 */
function auditLog(adminId: number, action: string, target: string, details?: any): void {
  logger.info(`[ADMIN] uid=${adminId} action=${action} target=${target}`, details || {});
}

export class AdminController {
  // ─── DASHBOARD ─────────────────────────────────────────────────────

  static async getStats(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [users, decks, cards, comments, activeUsers] = await Promise.all([
        query('SELECT COUNT(*) AS c FROM users'),
        query('SELECT COUNT(*) AS c FROM decks'),
        query('SELECT COUNT(*) AS c, COALESCE(SUM(quantity), 0) AS total FROM user_cards'),
        query('SELECT COUNT(*) AS c FROM deck_comments'),
        query(`SELECT COUNT(DISTINCT id) AS c FROM users WHERE updated_at > NOW() - INTERVAL '7 days'`),
      ]);

      const roleBreakdown = await query(
        `SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC`
      );

      const recentSignups = await query(
        `SELECT id, username, email, role, created_at
           FROM users
          ORDER BY created_at DESC
          LIMIT 5`
      );

      res.json({
        users: parseInt(users.rows[0].c),
        activeUsers7d: parseInt(activeUsers.rows[0].c),
        decks: parseInt(decks.rows[0].c),
        totalCardsInCollections: parseInt(cards.rows[0].total),
        uniqueCardEntries: parseInt(cards.rows[0].c),
        comments: parseInt(comments.rows[0].c),
        roleBreakdown: roleBreakdown.rows.map((r: any) => ({
          role: r.role,
          count: parseInt(r.count),
        })),
        recentSignups: recentSignups.rows,
      });
    } catch (error) {
      next(error);
    }
  }

  // ─── USERS ─────────────────────────────────────────────────────────

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();
      const roleFilter = req.query.role as string;

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (search) {
        conditions.push(`(username ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
        values.push(`%${search}%`);
        paramIdx++;
      }
      if (roleFilter && VALID_ROLES.includes(roleFilter as UserRole)) {
        conditions.push(`role = $${paramIdx}`);
        values.push(roleFilter);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(`SELECT COUNT(*) AS c FROM users ${whereClause}`, values);
      const total = parseInt(countResult.rows[0].c);

      values.push(limit, offset);
      const usersResult = await query(
        `SELECT u.id, u.username, u.email, u.role, u.profile_picture,
                u.is_active, u.disabled_at, u.created_at, u.updated_at,
                (SELECT COUNT(*) FROM decks WHERE user_id = u.id) AS deck_count,
                (SELECT COUNT(*) FROM user_cards WHERE user_id = u.id) AS card_count
           FROM users u
           ${whereClause}
          ORDER BY u.created_at DESC
          LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        values
      );

      res.json({
        users: usersResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUserDetail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) throw new ValidationError('Invalid user ID');

      const result = await query(
        `SELECT u.id, u.username, u.email, u.role, u.profile_picture,
                u.is_active, u.disabled_at, u.created_at, u.updated_at,
                (SELECT COUNT(*) FROM decks WHERE user_id = u.id) AS deck_count,
                (SELECT COUNT(*) FROM user_cards WHERE user_id = u.id) AS card_count,
                (SELECT COUNT(*) FROM deck_comments WHERE user_id = u.id) AS comment_count,
                (SELECT COUNT(*) FROM follows WHERE following_id = u.id) AS followers_count,
                (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following_count
           FROM users u
          WHERE u.id = $1`,
        [userId]
      );

      if (result.rows.length === 0) throw new NotFoundError('User not found');
      res.json({ user: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserRole(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;

      if (isNaN(userId)) throw new ValidationError('Invalid user ID');
      if (!VALID_ROLES.includes(role)) {
        throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
      }

      // Prevent an admin from demoting themselves — lockout protection
      if (req.user!.id === userId && role !== 'admin') {
        throw new ForbiddenError('You cannot demote yourself. Ask another admin.');
      }

      const result = await query(
        `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, role`,
        [role, userId]
      );
      if (result.rows.length === 0) throw new NotFoundError('User not found');

      auditLog(req.user!.id, 'update_role', `user:${userId}`, { newRole: role });
      res.json({ user: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async toggleUserActive(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      const { is_active } = req.body;

      if (isNaN(userId)) throw new ValidationError('Invalid user ID');
      if (typeof is_active !== 'boolean') {
        throw new ValidationError('is_active must be a boolean');
      }

      // Cannot disable yourself (lockout protection)
      if (req.user!.id === userId && !is_active) {
        throw new ForbiddenError('You cannot disable your own account.');
      }

      // Cannot disable another admin (safety)
      const check = await query('SELECT username, role FROM users WHERE id = $1', [userId]);
      if (check.rows.length === 0) throw new NotFoundError('User not found');
      if (!is_active && check.rows[0].role === 'admin') {
        throw new ForbiddenError(
          'Cannot disable another admin. Demote them to "user" first.'
        );
      }

      const result = await query(
        `UPDATE users
            SET is_active = $1,
                disabled_at = CASE WHEN $1 = false THEN NOW() ELSE NULL END,
                updated_at = NOW()
          WHERE id = $2
      RETURNING id, username, is_active, disabled_at`,
        [is_active, userId]
      );

      auditLog(req.user!.id, is_active ? 'enable_user' : 'disable_user', `user:${userId}`, {
        username: check.rows[0].username,
      });

      res.json({ user: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) throw new ValidationError('Invalid user ID');

      // Prevent self-deletion
      if (req.user!.id === userId) {
        throw new ForbiddenError('You cannot delete your own account from admin panel');
      }

      // Get username for audit before delete
      const check = await query('SELECT username, role FROM users WHERE id = $1', [userId]);
      if (check.rows.length === 0) throw new NotFoundError('User not found');
      const target = check.rows[0];

      // Prevent deleting other admins (safety)
      if (target.role === 'admin') {
        throw new ForbiddenError(
          'Cannot delete another admin. Demote them to "user" first.'
        );
      }

      // Cascade delete (relies on FK ON DELETE CASCADE — but let's do it explicit to be safe)
      await query('DELETE FROM notifications WHERE user_id = $1 OR from_user_id = $1', [userId]);
      await query('DELETE FROM deck_comments WHERE user_id = $1', [userId]);
      await query('DELETE FROM deck_reactions WHERE user_id = $1', [userId]);
      await query('DELETE FROM deck_wishlists WHERE user_id = $1', [userId]);
      await query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userId]);
      await query('DELETE FROM deck_cards WHERE deck_id IN (SELECT id FROM decks WHERE user_id = $1)', [userId]);
      await query('DELETE FROM decks WHERE user_id = $1', [userId]);
      await query('DELETE FROM user_cards WHERE user_id = $1', [userId]);
      await query('DELETE FROM users WHERE id = $1', [userId]);

      auditLog(req.user!.id, 'delete_user', `user:${userId}`, { username: target.username });
      res.json({ message: 'User deleted', username: target.username });
    } catch (error) {
      next(error);
    }
  }

  // ─── DECKS ─────────────────────────────────────────────────────────

  static async listDecks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (search) {
        conditions.push(`(d.name ILIKE $${paramIdx} OR u.username ILIKE $${paramIdx})`);
        values.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*) AS c FROM decks d JOIN users u ON d.user_id = u.id ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].c);

      values.push(limit, offset);
      const decksResult = await query(
        `SELECT d.id, d.name, d.is_public, d.respect_banlist,
                d.share_token IS NOT NULL AS is_shared,
                d.created_at, d.updated_at,
                u.id AS user_id, u.username, u.role AS user_role,
                (SELECT COUNT(*) FROM deck_cards WHERE deck_id = d.id) AS card_count,
                (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = true) AS likes,
                (SELECT COUNT(*) FROM deck_comments WHERE deck_id = d.id) AS comments
           FROM decks d
           JOIN users u ON d.user_id = u.id
           ${whereClause}
          ORDER BY d.created_at DESC
          LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        values
      );

      res.json({
        decks: decksResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deckId = parseInt(req.params.id);
      if (isNaN(deckId)) throw new ValidationError('Invalid deck ID');

      const check = await query(
        'SELECT name, user_id FROM decks WHERE id = $1',
        [deckId]
      );
      if (check.rows.length === 0) throw new NotFoundError('Deck not found');
      const target = check.rows[0];

      await query('DELETE FROM deck_cards WHERE deck_id = $1', [deckId]);
      await query('DELETE FROM deck_reactions WHERE deck_id = $1', [deckId]);
      await query('DELETE FROM deck_comments WHERE deck_id = $1', [deckId]);
      await query('DELETE FROM deck_wishlists WHERE original_deck_id = $1', [deckId]);
      await query('DELETE FROM notifications WHERE deck_id = $1', [deckId]);
      await query('DELETE FROM decks WHERE id = $1', [deckId]);

      auditLog(req.user!.id, 'delete_deck', `deck:${deckId}`, {
        name: target.name,
        ownerId: target.user_id,
      });
      res.json({ message: 'Deck deleted', name: target.name });
    } catch (error) {
      next(error);
    }
  }

  static async forceUnshareDeck(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const deckId = parseInt(req.params.id);
      if (isNaN(deckId)) throw new ValidationError('Invalid deck ID');

      const result = await query(
        `UPDATE decks
            SET share_token = NULL,
                share_token_expires_at = NULL,
                is_public = false,
                updated_at = NOW()
          WHERE id = $1
      RETURNING id, name`,
        [deckId]
      );
      if (result.rows.length === 0) throw new NotFoundError('Deck not found');

      auditLog(req.user!.id, 'force_unshare_deck', `deck:${deckId}`);
      res.json({ message: 'Deck unshared and set to private', deck: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  // ─── COMMENTS ──────────────────────────────────────────────────────

  static async listComments(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string || '').trim();

      const conditions: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (search) {
        conditions.push(`(c.content ILIKE $${paramIdx} OR u.username ILIKE $${paramIdx})`);
        values.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countResult = await query(
        `SELECT COUNT(*) AS c FROM deck_comments c JOIN users u ON c.user_id = u.id ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].c);

      values.push(limit, offset);
      const commentsResult = await query(
        `SELECT c.id, c.content, c.created_at, c.updated_at,
                c.parent_comment_id,
                u.id AS user_id, u.username,
                d.id AS deck_id, d.name AS deck_name
           FROM deck_comments c
           JOIN users u ON c.user_id = u.id
           JOIN decks d ON c.deck_id = d.id
           ${whereClause}
          ORDER BY c.created_at DESC
          LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        values
      );

      res.json({
        comments: commentsResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteComment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) throw new ValidationError('Invalid comment ID');

      const check = await query(
        'SELECT user_id, deck_id FROM deck_comments WHERE id = $1',
        [commentId]
      );
      if (check.rows.length === 0) throw new NotFoundError('Comment not found');

      // Delete replies first (cascade manual)
      await query('DELETE FROM deck_comments WHERE parent_comment_id = $1', [commentId]);
      await query('DELETE FROM deck_comments WHERE id = $1', [commentId]);

      auditLog(req.user!.id, 'delete_comment', `comment:${commentId}`, check.rows[0]);
      res.json({ message: 'Comment deleted' });
    } catch (error) {
      next(error);
    }
  }

  // ─── APPLICATION LOGS ──────────────────────────────────────────────
  //
  // Alimente la page /admin/logs — vue live des erreurs/warnings serveur,
  // erreurs front (via /api/client-errors) et crashs process. Le broadcast
  // temps réel se fait par la room socket `admin:logs` ; cet endpoint est
  // le fetch initial + les rechargements manuels (filtres, recherche).

  private static VALID_LEVELS: LogLevel[] = ['error', 'warn', 'info'];
  private static VALID_SOURCES: LogSource[] = ['server', 'client', 'crash', 'http'];

  static async listLogs(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawLevel = req.query.level as string | undefined;
      const rawSource = req.query.source as string | undefined;
      const level = rawLevel && AdminController.VALID_LEVELS.includes(rawLevel as LogLevel)
        ? (rawLevel as LogLevel)
        : undefined;
      const source = rawSource && AdminController.VALID_SOURCES.includes(rawSource as LogSource)
        ? (rawSource as LogSource)
        : undefined;

      // sinceId : polling / rattrapage — le front l'envoie pour ne recevoir
      // que les nouveaux logs quand le socket est temporairement HS.
      const sinceIdRaw = req.query.sinceId as string | undefined;
      const sinceId = sinceIdRaw && /^\d+$/.test(sinceIdRaw) ? sinceIdRaw : undefined;

      const limitRaw = parseInt(req.query.limit as string) || 100;
      const limit = Math.min(200, Math.max(1, limitRaw));

      const search = (req.query.search as string || '').trim().slice(0, 200);

      const result = await ApplicationLogModel.list({
        level,
        source,
        sinceId,
        limit,
        search: search || undefined,
      });

      res.json({ logs: result.logs, total: result.total });
    } catch (error) {
      next(error);
    }
  }
}
