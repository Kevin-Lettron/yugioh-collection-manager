import { query } from '../config/database';
import { DeckReaction } from '../../../shared/types';

export class DeckReactionModel {
  /**
   * Add or update reaction (like/dislike)
   */
  static async addReaction(
    userId: number,
    deckId: number,
    isLike: boolean
  ): Promise<DeckReaction> {
    const result = await query(
      `INSERT INTO deck_reactions (user_id, deck_id, is_like)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, deck_id)
       DO UPDATE SET is_like = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, deckId, isLike]
    );

    return result.rows[0];
  }

  /**
   * Remove reaction
   */
  static async removeReaction(userId: number, deckId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM deck_reactions WHERE user_id = $1 AND deck_id = $2 RETURNING id`,
      [userId, deckId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get user's reaction on a deck
   */
  static async getUserReaction(
    userId: number,
    deckId: number
  ): Promise<'like' | 'dislike' | null> {
    const result = await query(
      `SELECT is_like FROM deck_reactions WHERE user_id = $1 AND deck_id = $2`,
      [userId, deckId]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0].is_like ? 'like' : 'dislike';
  }

  /**
   * Get reaction counts for a deck
   */
  static async getReactionCounts(
    deckId: number
  ): Promise<{ likes: number; dislikes: number }> {
    const result = await query(
      `SELECT
        COUNT(CASE WHEN is_like = true THEN 1 END) as likes,
        COUNT(CASE WHEN is_like = false THEN 1 END) as dislikes
       FROM deck_reactions
       WHERE deck_id = $1`,
      [deckId]
    );

    return {
      likes: parseInt(result.rows[0].likes || 0),
      dislikes: parseInt(result.rows[0].dislikes || 0),
    };
  }

  /**
   * Get users who liked a deck
   */
  static async getLikes(
    deckId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<DeckReaction[]> {
    const result = await query(
      `SELECT dr.*, u.id as user_id, u.username, u.profile_picture
       FROM deck_reactions dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.deck_id = $1 AND dr.is_like = true
       ORDER BY dr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [deckId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      deck_id: row.deck_id,
      is_like: row.is_like,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        profile_picture: row.profile_picture,
      },
    }));
  }

  /**
   * Get users who disliked a deck
   */
  static async getDislikes(
    deckId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<DeckReaction[]> {
    const result = await query(
      `SELECT dr.*, u.id as user_id, u.username, u.profile_picture
       FROM deck_reactions dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.deck_id = $1 AND dr.is_like = false
       ORDER BY dr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [deckId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      deck_id: row.deck_id,
      is_like: row.is_like,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        profile_picture: row.profile_picture,
      },
    }));
  }
}
