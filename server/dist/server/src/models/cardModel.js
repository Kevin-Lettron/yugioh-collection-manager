"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardModel = void 0;
const database_1 = require("../config/database");
class CardModel {
    /**
     * Create or update a card (upsert based on card_id from API)
     */
    static async upsert(card) {
        const result = await (0, database_1.query)(`INSERT INTO cards (
        card_id, name, type, frame_type, description, atk, def, level, race,
        attribute, archetype, card_sets, card_images, card_prices, banlist_info,
        linkval, linkmarkers, scale
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (card_id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        frame_type = EXCLUDED.frame_type,
        description = EXCLUDED.description,
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
      RETURNING *`, [
            card.card_id,
            card.name,
            card.type,
            card.frame_type,
            card.description,
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
        ]);
        return this.parseCard(result.rows[0]);
    }
    /**
     * Find card by database ID
     */
    static async findById(id) {
        const result = await (0, database_1.query)(`SELECT * FROM cards WHERE id = $1`, [id]);
        return result.rows[0] ? this.parseCard(result.rows[0]) : null;
    }
    /**
     * Find card by YGOProDeck card_id
     */
    static async findByCardId(cardId) {
        const result = await (0, database_1.query)(`SELECT * FROM cards WHERE card_id = $1`, [cardId]);
        return result.rows[0] ? this.parseCard(result.rows[0]) : null;
    }
    /**
     * Find card by name
     */
    static async findByName(name) {
        const result = await (0, database_1.query)(`SELECT * FROM cards WHERE name ILIKE $1`, [name]);
        return result.rows[0] ? this.parseCard(result.rows[0]) : null;
    }
    /**
     * Search cards
     */
    static async search(searchTerm, filters, limit = 50, offset = 0) {
        const conditions = [];
        const values = [];
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
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM cards ${whereClause}`, values);
        const total = parseInt(countResult.rows[0].count);
        // Get paginated results
        values.push(limit, offset);
        const result = await (0, database_1.query)(`SELECT * FROM cards ${whereClause} ORDER BY name LIMIT $${paramCount} OFFSET $${paramCount + 1}`, values);
        const cards = result.rows.map(row => this.parseCard(row));
        return { cards, total };
    }
    /**
     * Parse card from database row (convert JSONB to objects)
     */
    static parseCard(row) {
        return {
            ...row,
            card_sets: row.card_sets || [],
            card_images: row.card_images || [],
            card_prices: row.card_prices || {},
            banlist_info: row.banlist_info || {},
            linkmarkers: row.linkmarkers || [],
        };
    }
}
exports.CardModel = CardModel;
