import { query, getClient } from '../config/database';
import { Deck, DeckCard, DeckFilters, PaginatedResponse, Card } from '../../../shared/types';
import { YGOProDeckService } from '../services/ygoprodeckService';

export class DeckModel {
  /**
   * Create a new deck
   */
  static async create(
    userId: number,
    name: string,
    respectBanlist: boolean = true,
    isPublic: boolean = true,
    coverImage?: string
  ): Promise<Deck> {
    const result = await query(
      `INSERT INTO decks (user_id, name, respect_banlist, is_public, cover_image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, respectBanlist, isPublic, coverImage || null]
    );

    return result.rows[0];
  }

  /**
   * Get deck by ID with full details
   */
  static async findById(deckId: number, requestingUserId?: number): Promise<Deck | null> {
    const result = await query(
      `SELECT d.*,
              u.id as user_id, u.username, u.email, u.profile_picture,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = true) as likes_count,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = false) as dislikes_count,
              (SELECT COUNT(*) FROM deck_comments WHERE deck_id = d.id) as comments_count
       FROM decks d
       JOIN users u ON d.user_id = u.id
       WHERE d.id = $1`,
      [deckId]
    );

    if (result.rows.length === 0) return null;

    const deck = result.rows[0];

    // Get main deck and extra deck cards
    const cardsResult = await query(
      `SELECT dc.*,
              c.id as card_db_id, c.card_id, c.name, c.type, c.frame_type, c.description,
              c.atk, c.def, c.level, c.race, c.attribute, c.archetype,
              c.card_sets, c.card_images, c.card_prices, c.banlist_info,
              c.linkval, c.linkmarkers, c.scale
       FROM deck_cards dc
       JOIN cards c ON dc.card_id = c.id
       WHERE dc.deck_id = $1
       ORDER BY c.name`,
      [deckId]
    );

    const mainDeck: DeckCard[] = [];
    const extraDeck: DeckCard[] = [];

    cardsResult.rows.forEach((row) => {
      const deckCard = this.parseDeckCard(row);
      if (row.is_extra_deck) {
        extraDeck.push(deckCard);
      } else {
        mainDeck.push(deckCard);
      }
    });

    // Check if requesting user has reacted
    let userReaction = null;
    if (requestingUserId) {
      const reactionResult = await query(
        `SELECT is_like FROM deck_reactions WHERE deck_id = $1 AND user_id = $2`,
        [deckId, requestingUserId]
      );
      if (reactionResult.rows.length > 0) {
        userReaction = reactionResult.rows[0].is_like ? 'like' : 'dislike';
      }

      // Check if wishlisted
      const wishlistResult = await query(
        `SELECT id FROM deck_wishlists WHERE deck_id = $1 AND user_id = $2`,
        [deckId, requestingUserId]
      );
      deck.is_wishlisted = wishlistResult.rows.length > 0;
    }

    return {
      id: deck.id,
      user_id: deck.user_id,
      name: deck.name,
      cover_image: deck.cover_image,
      is_public: deck.is_public,
      respect_banlist: deck.respect_banlist,
      created_at: deck.created_at,
      updated_at: deck.updated_at,
      user: {
        id: deck.user_id,
        username: deck.username,
        email: deck.email,
        profile_picture: deck.profile_picture,
        created_at: deck.created_at,
        updated_at: deck.updated_at,
      },
      main_deck: mainDeck,
      extra_deck: extraDeck,
      likes_count: parseInt(deck.likes_count || 0),
      dislikes_count: parseInt(deck.dislikes_count || 0),
      comments_count: parseInt(deck.comments_count || 0),
      user_reaction: userReaction,
      is_wishlisted: deck.is_wishlisted || false,
    };
  }

  /**
   * Get user's decks with filters
   */
  static async getUserDecks(
    userId: number,
    filters: DeckFilters = {}
  ): Promise<PaginatedResponse<Deck>> {
    const { page = 1, limit = 20, search, respect_banlist } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['d.user_id = $1'];
    const values: any[] = [userId];
    let paramCount = 2;

    if (search) {
      conditions.push(`d.name ILIKE $${paramCount}`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (respect_banlist !== undefined) {
      conditions.push(`d.respect_banlist = $${paramCount}`);
      values.push(respect_banlist);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM decks d WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    values.push(limit, offset);
    const result = await query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = true) as likes_count,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = false) as dislikes_count,
              (SELECT COUNT(*) FROM deck_comments WHERE deck_id = d.id) as comments_count
       FROM decks d
       WHERE ${whereClause}
       ORDER BY d.updated_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      cover_image: row.cover_image,
      is_public: row.is_public,
      respect_banlist: row.respect_banlist,
      created_at: row.created_at,
      updated_at: row.updated_at,
      likes_count: parseInt(row.likes_count || 0),
      dislikes_count: parseInt(row.dislikes_count || 0),
      comments_count: parseInt(row.comments_count || 0),
    }));

    return {
      data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Search public decks
   */
  static async searchPublicDecks(
    filters: DeckFilters = {},
    requestingUserId?: number
  ): Promise<PaginatedResponse<Deck>> {
    const { page = 1, limit = 20, search, respect_banlist, user_id } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['d.is_public = true'];
    const values: any[] = [];
    let paramCount = 1;

    if (search) {
      conditions.push(`d.name ILIKE $${paramCount}`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (respect_banlist !== undefined) {
      conditions.push(`d.respect_banlist = $${paramCount}`);
      values.push(respect_banlist);
      paramCount++;
    }

    if (user_id) {
      conditions.push(`d.user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM decks d WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    values.push(limit, offset);
    const result = await query(
      `SELECT d.*, u.username, u.profile_picture,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = true) as likes_count,
              (SELECT COUNT(*) FROM deck_reactions WHERE deck_id = d.id AND is_like = false) as dislikes_count,
              (SELECT COUNT(*) FROM deck_comments WHERE deck_id = d.id) as comments_count
       FROM decks d
       JOIN users u ON d.user_id = u.id
       WHERE ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      cover_image: row.cover_image,
      is_public: row.is_public,
      respect_banlist: row.respect_banlist,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        profile_picture: row.profile_picture,
      },
      likes_count: parseInt(row.likes_count || 0),
      dislikes_count: parseInt(row.dislikes_count || 0),
      comments_count: parseInt(row.comments_count || 0),
    }));

    return {
      data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update deck
   */
  static async update(
    deckId: number,
    userId: number,
    updates: {
      name?: string;
      respect_banlist?: boolean;
      is_public?: boolean;
      cover_image?: string;
    }
  ): Promise<Deck | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.respect_banlist !== undefined) {
      fields.push(`respect_banlist = $${paramCount++}`);
      values.push(updates.respect_banlist);
    }

    if (updates.is_public !== undefined) {
      fields.push(`is_public = $${paramCount++}`);
      values.push(updates.is_public);
    }

    if (updates.cover_image !== undefined) {
      fields.push(`cover_image = $${paramCount++}`);
      values.push(updates.cover_image);
    }

    if (fields.length === 0) {
      return this.findById(deckId, userId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(deckId, userId);

    const result = await query(
      `UPDATE decks
       SET ${fields.join(', ')}
       WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    return result.rows[0] ? this.findById(result.rows[0].id, userId) : null;
  }

  /**
   * Delete deck
   */
  static async delete(deckId: number, userId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM decks WHERE id = $1 AND user_id = $2 RETURNING id`,
      [deckId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Add card to deck with validation
   */
  static async addCard(
    deckId: number,
    userId: number,
    cardId: number,
    quantity: number,
    isExtraDeck: boolean,
    card: Card
  ): Promise<{ success: boolean; error?: string }> {
    // Verify deck ownership
    const deck = await this.findById(deckId, userId);
    if (!deck || deck.user_id !== userId) {
      return { success: false, error: 'Deck not found or unauthorized' };
    }

    // Validate card placement (Main vs Extra deck)
    const cardIsExtraDeck = YGOProDeckService.isExtraDeckCard(card.frame_type);

    if (isExtraDeck && !cardIsExtraDeck) {
      return {
        success: false,
        error: 'Cannot add non-Extra Deck monsters to Extra Deck',
      };
    }

    if (!isExtraDeck && cardIsExtraDeck) {
      return {
        success: false,
        error: 'Extra Deck monsters must be added to Extra Deck',
      };
    }

    // Check current card count across both decks
    const countResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN is_extra_deck = false THEN quantity ELSE 0 END), 0) as main_count,
        COALESCE(SUM(CASE WHEN is_extra_deck = true THEN quantity ELSE 0 END), 0) as extra_count,
        COALESCE(SUM(CASE WHEN card_id = $2 THEN quantity ELSE 0 END), 0) as card_copies
       FROM deck_cards
       WHERE deck_id = $1`,
      [deckId, cardId]
    );

    const { main_count, extra_count, card_copies } = countResult.rows[0];
    const mainCount = parseInt(main_count);
    const extraCount = parseInt(extra_count);
    const existingCopies = parseInt(card_copies);

    // Validate deck size limits
    if (!isExtraDeck && mainCount + quantity > 60) {
      return { success: false, error: 'Main Deck cannot exceed 60 cards' };
    }

    if (isExtraDeck && extraCount + quantity > 15) {
      return { success: false, error: 'Extra Deck cannot exceed 15 cards' };
    }

    // Validate banlist if enabled
    if (deck.respect_banlist) {
      const banlistLimit = YGOProDeckService.getBanlistLimit(card);

      if (banlistLimit === 0) {
        return {
          success: false,
          error: `${card.name} is Forbidden and cannot be added when respecting banlist`,
        };
      }

      if (existingCopies + quantity > banlistLimit) {
        return {
          success: false,
          error: `Banlist allows only ${banlistLimit} cop${banlistLimit > 1 ? 'ies' : 'y'} of ${card.name}`,
        };
      }
    } else {
      // Standard 3-copy rule
      if (existingCopies + quantity > 3) {
        return {
          success: false,
          error: `Maximum 3 copies of ${card.name} allowed per deck`,
        };
      }
    }

    // Add or update card
    await query(
      `INSERT INTO deck_cards (deck_id, card_id, quantity, is_extra_deck)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (deck_id, card_id, is_extra_deck)
       DO UPDATE SET quantity = deck_cards.quantity + $3`,
      [deckId, cardId, quantity, isExtraDeck]
    );

    // Update deck timestamp
    await query(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [deckId]);

    return { success: true };
  }

  /**
   * Remove card from deck
   */
  static async removeCard(
    deckId: number,
    userId: number,
    deckCardId: number
  ): Promise<boolean> {
    // Verify deck ownership
    const deck = await this.findById(deckId, userId);
    if (!deck || deck.user_id !== userId) {
      return false;
    }

    const result = await query(
      `DELETE FROM deck_cards WHERE id = $1 AND deck_id = $2 RETURNING id`,
      [deckCardId, deckId]
    );

    if (result.rows.length > 0) {
      await query(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [deckId]);
      return true;
    }

    return false;
  }

  /**
   * Update card quantity in deck
   */
  static async updateCardQuantity(
    deckId: number,
    userId: number,
    deckCardId: number,
    quantity: number,
    card: Card
  ): Promise<{ success: boolean; error?: string }> {
    // Verify deck ownership
    const deck = await this.findById(deckId, userId);
    if (!deck || deck.user_id !== userId) {
      return { success: false, error: 'Deck not found or unauthorized' };
    }

    if (quantity <= 0) {
      await this.removeCard(deckId, userId, deckCardId);
      return { success: true };
    }

    // Get existing card info
    const cardResult = await query(
      `SELECT card_id, quantity, is_extra_deck FROM deck_cards WHERE id = $1 AND deck_id = $2`,
      [deckCardId, deckId]
    );

    if (cardResult.rows.length === 0) {
      return { success: false, error: 'Card not found in deck' };
    }

    const { card_id, quantity: oldQuantity, is_extra_deck } = cardResult.rows[0];
    const quantityDiff = quantity - oldQuantity;

    // Check total copies across deck
    const countResult = await query(
      `SELECT COALESCE(SUM(quantity), 0) as total_copies
       FROM deck_cards
       WHERE deck_id = $1 AND card_id = $2`,
      [deckId, card_id]
    );

    const totalCopies = parseInt(countResult.rows[0].total_copies);
    const newTotalCopies = totalCopies + quantityDiff;

    // Validate banlist
    if (deck.respect_banlist) {
      const banlistLimit = YGOProDeckService.getBanlistLimit(card);
      if (newTotalCopies > banlistLimit) {
        return {
          success: false,
          error: `Banlist allows only ${banlistLimit} cop${banlistLimit > 1 ? 'ies' : 'y'} of ${card.name}`,
        };
      }
    } else {
      if (newTotalCopies > 3) {
        return {
          success: false,
          error: `Maximum 3 copies of ${card.name} allowed per deck`,
        };
      }
    }

    // Update quantity
    await query(
      `UPDATE deck_cards SET quantity = $1 WHERE id = $2 AND deck_id = $3`,
      [quantity, deckCardId, deckId]
    );

    await query(`UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [deckId]);

    return { success: true };
  }

  /**
   * Validate deck (check if it meets Yu-Gi-Oh rules)
   */
  static async validateDeck(deckId: number): Promise<{
    valid: boolean;
    errors: string[];
    mainDeckCount: number;
    extraDeckCount: number;
  }> {
    const countResult = await query(
      `SELECT
        COALESCE(SUM(CASE WHEN is_extra_deck = false THEN quantity ELSE 0 END), 0) as main_count,
        COALESCE(SUM(CASE WHEN is_extra_deck = true THEN quantity ELSE 0 END), 0) as extra_count
       FROM deck_cards
       WHERE deck_id = $1`,
      [deckId]
    );

    const mainDeckCount = parseInt(countResult.rows[0].main_count);
    const extraDeckCount = parseInt(countResult.rows[0].extra_count);

    const errors: string[] = [];

    if (mainDeckCount < 40) {
      errors.push('Main Deck must have at least 40 cards');
    }

    if (mainDeckCount > 60) {
      errors.push('Main Deck cannot exceed 60 cards');
    }

    if (extraDeckCount > 15) {
      errors.push('Extra Deck cannot exceed 15 cards');
    }

    return {
      valid: errors.length === 0,
      errors,
      mainDeckCount,
      extraDeckCount,
    };
  }

  /**
   * Parse deck card with nested card data
   */
  private static parseDeckCard(row: any): DeckCard {
    return {
      id: row.id,
      deck_id: row.deck_id,
      card_id: row.card_id,
      quantity: row.quantity,
      is_extra_deck: row.is_extra_deck,
      created_at: row.created_at,
      card: {
        id: row.card_db_id,
        card_id: row.card_id,
        name: row.name,
        type: row.type,
        frame_type: row.frame_type,
        description: row.description,
        atk: row.atk,
        def: row.def,
        level: row.level,
        race: row.race,
        attribute: row.attribute,
        archetype: row.archetype,
        card_sets: row.card_sets || [],
        card_images: row.card_images || [],
        card_prices: row.card_prices || {},
        banlist_info: row.banlist_info || {},
        linkval: row.linkval,
        linkmarkers: row.linkmarkers || [],
        scale: row.scale,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  }
}
