import { query } from '../config/database';
import { DeckWishlist } from '../../../shared/types';

export class WishlistModel {
  /**
   * Add deck to wishlist
   */
  static async addToWishlist(userId: number, deckId: number): Promise<DeckWishlist | null> {
    try {
      const result = await query(
        `INSERT INTO deck_wishlists (user_id, original_deck_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, original_deck_id) DO NOTHING
         RETURNING *`,
        [userId, deckId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      return null;
    }
  }

  /**
   * Remove deck from wishlist
   */
  static async removeFromWishlist(userId: number, deckId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM deck_wishlists WHERE user_id = $1 AND original_deck_id = $2 RETURNING id`,
      [userId, deckId]
    );

    return result.rows.length > 0;
  }

  /**
   * Check if deck is in user's wishlist
   */
  static async isInWishlist(userId: number, deckId: number): Promise<boolean> {
    const result = await query(
      `SELECT id FROM deck_wishlists WHERE user_id = $1 AND original_deck_id = $2`,
      [userId, deckId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get user's wishlist
   */
  static async getUserWishlist(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ wishlists: DeckWishlist[]; total: number }> {
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM deck_wishlists WHERE user_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get wishlist with deck details
    const result = await query(
      `SELECT dw.*,
              d.id as deck_id, d.name as deck_name, d.cover_image, d.user_id as deck_user_id,
              d.is_public, d.respect_banlist, d.created_at as deck_created_at,
              u.username as deck_owner_username, u.profile_picture as deck_owner_picture,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = true) as likes_count,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = false) as dislikes_count
       FROM deck_wishlists dw
       JOIN decks d ON dw.original_deck_id = d.id
       JOIN users u ON d.user_id = u.id
       WHERE dw.user_id = $1
       ORDER BY dw.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const wishlists = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      original_deck_id: row.original_deck_id,
      created_at: row.created_at,
      deck: {
        id: row.deck_id,
        user_id: row.deck_user_id,
        name: row.deck_name,
        cover_image: row.cover_image,
        is_public: row.is_public,
        respect_banlist: row.respect_banlist,
        created_at: row.deck_created_at,
        updated_at: row.deck_created_at,
        user: {
          id: row.deck_user_id,
          username: row.deck_owner_username,
          profile_picture: row.deck_owner_picture,
        },
        likes_count: parseInt(row.likes_count || 0),
        dislikes_count: parseInt(row.dislikes_count || 0),
      },
    }));

    return { wishlists, total };
  }

  /**
   * Get count of wishlists for a deck
   */
  static async getWishlistCount(deckId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM deck_wishlists WHERE original_deck_id = $1`,
      [deckId]
    );

    return parseInt(result.rows[0].count);
  }
}
