import { query } from '../config/database';
import { UserCard, CollectionFilters, PaginatedResponse, CollectionStats } from '../../../shared/types';
import { cardmarketPriceEUR, isUltraRare, isSecretRare } from '../utils/prices';

export class UserCardModel {
  /**
   * Add card to user's collection
   * @param language - Card language (EN, FR, DE, IT, PT, SP, JP, KR)
   */
  static async addToCollection(
    userId: number,
    cardId: number,
    setCode: string,
    rarity: string,
    quantity: number = 1,
    language: string = 'EN'
  ): Promise<UserCard> {
    const result = await query(
      `INSERT INTO user_cards (user_id, card_id, set_code, rarity, quantity, language)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, card_id, set_code, rarity, language)
       DO UPDATE SET quantity = user_cards.quantity + $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, cardId, setCode, rarity, quantity, language]
    );

    return result.rows[0];
  }

  /**
   * Get user's collection with filters and pagination
   */
  static async getUserCollection(
    userId: number,
    filters: CollectionFilters = {}
  ): Promise<PaginatedResponse<UserCard>> {
    const {
      page = 1,
      limit = 50,
      search,
      type,
      frame_type,
      rarity,
      level,
      min_atk,
      max_atk,
      min_def,
      max_def,
      attribute,
      race,
      card_id,
    } = filters;

    const offset = (page - 1) * limit;
    const conditions: string[] = ['uc.user_id = $1'];
    const values: any[] = [userId];
    let paramCount = 2;

    // Card ID filter (filter by cards.id - the database PK)
    if (card_id !== undefined) {
      conditions.push(`c.id = $${paramCount}`);
      values.push(card_id);
      paramCount++;
    }

    // Search filter
    if (search) {
      conditions.push(`(c.name ILIKE $${paramCount} OR c.description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    // Type filter
    if (type) {
      conditions.push(`c.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    // Frame type filter
    if (frame_type) {
      conditions.push(`c.frame_type = $${paramCount}`);
      values.push(frame_type);
      paramCount++;
    }

    // Rarity filter
    if (rarity) {
      conditions.push(`uc.rarity = $${paramCount}`);
      values.push(rarity);
      paramCount++;
    }

    // Level filter
    if (level !== undefined) {
      conditions.push(`c.level = $${paramCount}`);
      values.push(level);
      paramCount++;
    }

    // ATK filters
    if (min_atk !== undefined) {
      conditions.push(`c.atk >= $${paramCount}`);
      values.push(min_atk);
      paramCount++;
    }

    if (max_atk !== undefined) {
      conditions.push(`c.atk <= $${paramCount}`);
      values.push(max_atk);
      paramCount++;
    }

    // DEF filters
    if (min_def !== undefined) {
      conditions.push(`c.def >= $${paramCount}`);
      values.push(min_def);
      paramCount++;
    }

    if (max_def !== undefined) {
      conditions.push(`c.def <= $${paramCount}`);
      values.push(max_def);
      paramCount++;
    }

    // Attribute filter
    if (attribute) {
      conditions.push(`c.attribute = $${paramCount}`);
      values.push(attribute);
      paramCount++;
    }

    // Race filter
    if (race) {
      conditions.push(`c.race = $${paramCount}`);
      values.push(race);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count
       FROM user_cards uc
       JOIN cards c ON uc.card_id = c.id
       WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results with card data
    values.push(limit, offset);
    const result = await query(
      `SELECT uc.id, uc.user_id, uc.card_id as user_card_card_id, uc.set_code, uc.rarity, uc.language, uc.quantity, uc.created_at, uc.updated_at,
              c.id as card_db_id, c.card_id as card_api_id, c.name, c.type, c.frame_type, c.description,
              c.atk, c.def, c.level, c.race, c.attribute, c.archetype,
              c.card_sets, c.card_images, c.card_prices, c.banlist_info,
              c.linkval, c.linkmarkers, c.scale
       FROM user_cards uc
       JOIN cards c ON uc.card_id = c.id
       WHERE ${whereClause}
       ORDER BY c.name, uc.set_code, uc.rarity
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );

    const data = result.rows.map((row) => this.parseUserCard(row));
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      total_pages: totalPages,
    };
  }

  /**
   * Get specific card from user's collection
   */
  static async getUserCard(userId: number, cardId: number): Promise<UserCard | null> {
    const result = await query(
      `SELECT uc.id, uc.user_id, uc.card_id as user_card_card_id, uc.set_code, uc.rarity, uc.language, uc.quantity, uc.created_at, uc.updated_at,
              c.id as card_db_id, c.card_id as card_api_id, c.name, c.type, c.frame_type, c.description,
              c.atk, c.def, c.level, c.race, c.attribute, c.archetype,
              c.card_sets, c.card_images, c.card_prices, c.banlist_info,
              c.linkval, c.linkmarkers, c.scale
       FROM user_cards uc
       JOIN cards c ON uc.card_id = c.id
       WHERE uc.user_id = $1 AND uc.card_id = $2`,
      [userId, cardId]
    );

    return result.rows[0] ? this.parseUserCard(result.rows[0]) : null;
  }

  /**
   * Check if user has card in collection
   */
  static async hasCard(userId: number, cardId: number): Promise<boolean> {
    const result = await query(
      `SELECT COUNT(*) as count FROM user_cards WHERE user_id = $1 AND card_id = $2`,
      [userId, cardId]
    );

    return parseInt(result.rows[0].count) > 0;
  }

  /**
   * Get total quantity of a card in user's collection (all rarities)
   */
  static async getTotalQuantity(userId: number, cardId: number): Promise<number> {
    const result = await query(
      `SELECT SUM(quantity) as total FROM user_cards WHERE user_id = $1 AND card_id = $2`,
      [userId, cardId]
    );

    return parseInt(result.rows[0].total || 0);
  }

  /**
   * Update card quantity
   */
  static async updateQuantity(
    userId: number,
    userCardId: number,
    quantity: number
  ): Promise<UserCard | null> {
    if (quantity <= 0) {
      await query(`DELETE FROM user_cards WHERE id = $1 AND user_id = $2`, [userCardId, userId]);
      return null;
    }

    const result = await query(
      `UPDATE user_cards
       SET quantity = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [quantity, userCardId, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Remove card from collection
   */
  static async removeFromCollection(userId: number, userCardId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM user_cards WHERE id = $1 AND user_id = $2 RETURNING id`,
      [userCardId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Disponibilité par carte pour l'éditeur de deck.
   * Pour chaque carte possédée par l'user, retourne :
   *   - owned : total quantite (toutes editions/raretes confondues)
   *   - used_in_decks : somme quantite dans les autres decks de l'user (excluant `excludeDeckId`)
   *   - available : owned - used_in_decks (peut etre 0, jamais negatif)
   *
   * Cle du Record = cards.id (int DB, celui exposé dans DeckCard.card_id côté front).
   */
  static async getAvailability(
    userId: number,
    excludeDeckId?: number
  ): Promise<Record<number, { owned: number; used_in_decks: number; available: number }>> {
    const ownedRes = await query(
      `SELECT card_id AS db_id, SUM(quantity)::int AS owned
       FROM user_cards
       WHERE user_id = $1
       GROUP BY card_id`,
      [userId]
    );

    const usedRes = await query(
      `SELECT dc.card_id AS db_id, SUM(dc.quantity)::int AS used
       FROM deck_cards dc
       JOIN decks d ON d.id = dc.deck_id
       WHERE d.user_id = $1
         AND ($2::int IS NULL OR d.id != $2)
       GROUP BY dc.card_id`,
      [userId, excludeDeckId ?? null]
    );

    const usedMap = new Map<number, number>();
    for (const row of usedRes.rows) usedMap.set(Number(row.db_id), Number(row.used));

    const out: Record<number, { owned: number; used_in_decks: number; available: number }> = {};
    for (const row of ownedRes.rows) {
      const dbId = Number(row.db_id);
      const owned = Number(row.owned) || 0;
      const used = usedMap.get(dbId) || 0;
      out[dbId] = {
        owned,
        used_in_decks: used,
        available: Math.max(0, owned - used),
      };
    }
    return out;
  }

  /**
   * Agrège les stats de la collection en un seul passage.
   * On récupère seulement les colonnes utiles (rarity, frame_type, card_prices, quantity, created_at)
   * pour éviter de tirer les descriptions/images pour rien.
   */
  static async getCollectionStats(userId: number): Promise<CollectionStats> {
    const result = await query(
      `SELECT uc.rarity, uc.quantity, uc.created_at,
              c.frame_type, c.type, c.card_prices
       FROM user_cards uc
       JOIN cards c ON uc.card_id = c.id
       WHERE uc.user_id = $1`,
      [userId]
    );

    const stats: CollectionStats = {
      total_cards: 0,
      unique_cards: result.rows.length,
      ultra_rares_count: 0,
      secret_rares_count: 0,
      total_value_eur: 0,
      by_type: { monster: 0, spell: 0, trap: 0, extra: 0 },
      recent_added_30d: 0,
      rarities: [],
      rarity_counts: {},
    };

    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const extraTypes = new Set(['fusion', 'synchro', 'xyz', 'link']);
    // Compte par rareté pour trier par fréquence desc dans la liste déroulante.
    const rarityCounts = new Map<string, number>();

    for (const row of result.rows) {
      const qty = Number(row.quantity) || 0;
      stats.total_cards += qty;

      if (row.rarity) {
        rarityCounts.set(row.rarity, (rarityCounts.get(row.rarity) || 0) + qty);
      }

      if (isUltraRare(row.rarity)) stats.ultra_rares_count += qty;
      if (isSecretRare(row.rarity)) stats.secret_rares_count += qty;

      const p = cardmarketPriceEUR(row.card_prices);
      if (p) stats.total_value_eur += p * qty;

      const frame = (row.frame_type || '').toLowerCase();
      const type = (row.type || '').toLowerCase();
      if (extraTypes.has(frame)) stats.by_type.extra += qty;
      else if (type.includes('spell')) stats.by_type.spell += qty;
      else if (type.includes('trap')) stats.by_type.trap += qty;
      else stats.by_type.monster += qty;

      if (row.created_at && now - new Date(row.created_at).getTime() <= THIRTY_DAYS_MS) {
        stats.recent_added_30d += qty;
      }
    }

    const sortedRarities = Array.from(rarityCounts.entries()).sort((a, b) => b[1] - a[1]);
    stats.rarities = sortedRarities.map(([r]) => r);
    stats.rarity_counts = Object.fromEntries(sortedRarities);

    stats.total_value_eur = Math.round(stats.total_value_eur * 100) / 100;
    return stats;
  }

  /**
   * Parse user card with nested card data
   */
  private static parseUserCard(row: any): UserCard {
    return {
      id: row.id,
      user_id: row.user_id,
      card_id: row.user_card_card_id, // FK to cards.id (number)
      set_code: row.set_code,
      rarity: row.rarity,
      language: row.language || 'EN',
      quantity: row.quantity,
      created_at: row.created_at,
      updated_at: row.updated_at,
      card: {
        id: row.card_db_id, // cards.id (number) - the database ID
        card_id: row.card_api_id, // cards.card_id (string) - the YGOProDeck API ID
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
