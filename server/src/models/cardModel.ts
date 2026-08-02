import { query } from '../config/database';
import { Card } from '../../../shared/types';

export class CardModel {
  /**
   * Create or update a card (upsert based on card_id from API)
   */
  static async upsert(card: Omit<Card, 'id' | 'created_at' | 'updated_at'>): Promise<Card> {
    // Sur ON CONFLICT, on ne veut PAS ecraser name_fr/description_fr par NULL
    // si la nouvelle insert n'a pas les trads (ex: fetch qui a echoue sur FR).
    // COALESCE garde l'ancienne valeur si la nouvelle est NULL.
    const result = await query(
      `INSERT INTO cards (
        card_id, name, name_fr, type, frame_type, description, description_fr,
        atk, def, level, race, attribute, archetype, card_sets, card_images,
        card_prices, banlist_info, linkval, linkmarkers, scale
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (card_id) DO UPDATE SET
        name = EXCLUDED.name,
        name_fr = COALESCE(EXCLUDED.name_fr, cards.name_fr),
        type = EXCLUDED.type,
        frame_type = EXCLUDED.frame_type,
        description = EXCLUDED.description,
        description_fr = COALESCE(EXCLUDED.description_fr, cards.description_fr),
        atk = EXCLUDED.atk,
        def = EXCLUDED.def,
        level = EXCLUDED.level,
        race = EXCLUDED.race,
        attribute = EXCLUDED.attribute,
        archetype = EXCLUDED.archetype,
        card_sets = EXCLUDED.card_sets,
        card_images = EXCLUDED.card_images,
        card_prices = EXCLUDED.card_prices,
        banlist_info = EXCLUDED.banlist_info,
        linkval = EXCLUDED.linkval,
        linkmarkers = EXCLUDED.linkmarkers,
        scale = EXCLUDED.scale,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        card.card_id,
        card.name,
        card.name_fr ?? null,
        card.type,
        card.frame_type,
        card.description,
        card.description_fr ?? null,
        card.atk,
        card.def,
        card.level,
        card.race,
        card.attribute,
        card.archetype,
        JSON.stringify(card.card_sets || []),
        JSON.stringify(card.card_images || []),
        JSON.stringify(card.card_prices || {}),
        JSON.stringify(card.banlist_info || {}),
        card.linkval,
        JSON.stringify(card.linkmarkers || []),
        card.scale,
      ]
    );

    return this.parseCard(result.rows[0]);
  }

  /**
   * Find card by database ID
   */
  static async findById(id: number): Promise<Card | null> {
    const result = await query(`SELECT * FROM cards WHERE id = $1`, [id]);
    return result.rows[0] ? this.parseCard(result.rows[0]) : null;
  }

  /**
   * Find card by YGOProDeck card_id
   */
  static async findByCardId(cardId: string): Promise<Card | null> {
    const result = await query(`SELECT * FROM cards WHERE card_id = $1`, [cardId]);
    return result.rows[0] ? this.parseCard(result.rows[0]) : null;
  }

  /**
   * Find card by name
   */
  static async findByName(name: string): Promise<Card | null> {
    const result = await query(`SELECT * FROM cards WHERE name ILIKE $1`, [name]);
    return result.rows[0] ? this.parseCard(result.rows[0]) : null;
  }

  /**
   * Search cards
   */
  static async search(
    searchTerm: string,
    filters?: {
      type?: string;
      frame_type?: string;
      level?: number;
      attribute?: string;
      race?: string;
      min_atk?: number;
      max_atk?: number;
      min_def?: number;
      max_def?: number;
    },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ cards: Card[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Search term
    if (searchTerm) {
      conditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      values.push(`%${searchTerm}%`);
      paramCount++;
    }

    // Filters
    if (filters?.type) {
      conditions.push(`type = $${paramCount}`);
      values.push(filters.type);
      paramCount++;
    }

    if (filters?.frame_type) {
      conditions.push(`frame_type = $${paramCount}`);
      values.push(filters.frame_type);
      paramCount++;
    }

    if (filters?.level !== undefined) {
      conditions.push(`level = $${paramCount}`);
      values.push(filters.level);
      paramCount++;
    }

    if (filters?.attribute) {
      conditions.push(`attribute = $${paramCount}`);
      values.push(filters.attribute);
      paramCount++;
    }

    if (filters?.race) {
      conditions.push(`race = $${paramCount}`);
      values.push(filters.race);
      paramCount++;
    }

    if (filters?.min_atk !== undefined) {
      conditions.push(`atk >= $${paramCount}`);
      values.push(filters.min_atk);
      paramCount++;
    }

    if (filters?.max_atk !== undefined) {
      conditions.push(`atk <= $${paramCount}`);
      values.push(filters.max_atk);
      paramCount++;
    }

    if (filters?.min_def !== undefined) {
      conditions.push(`def >= $${paramCount}`);
      values.push(filters.min_def);
      paramCount++;
    }

    if (filters?.max_def !== undefined) {
      conditions.push(`def <= $${paramCount}`);
      values.push(filters.max_def);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM cards ${whereClause}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    values.push(limit, offset);
    const result = await query(
      `SELECT * FROM cards ${whereClause} ORDER BY name LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      values
    );

    const cards = result.rows.map(row => this.parseCard(row));

    return { cards, total };
  }

  /**
   * Parse card from database row (convert JSONB to objects)
   */
  private static parseCard(row: any): Card {
    // On expose la version FR officielle Konami TCG en tant que `name` /
    // `description` si dispo (les clients recoivent du FR par defaut sans
    // devoir toucher a leurs 50 usages `.card?.name`). L'EN reste accessible
    // via `name_en` / `description_en` pour toute logique qui en aurait besoin.
    return {
      ...row,
      name: row.name_fr || row.name,
      description: row.description_fr || row.description,
      name_en: row.name,
      description_en: row.description,
      card_sets: row.card_sets || [],
      card_images: row.card_images || [],
      card_prices: row.card_prices || {},
      banlist_info: row.banlist_info || {},
      linkmarkers: row.linkmarkers || [],
    };
  }
}
