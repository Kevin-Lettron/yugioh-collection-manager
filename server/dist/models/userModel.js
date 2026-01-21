"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const database_1 = require("../config/database");
const bcrypt_1 = __importDefault(require("bcrypt"));
class UserModel {
    /**
     * Create a new user
     */
    static async create(username, email, password) {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const result = await (0, database_1.query)(`INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, profile_picture, created_at, updated_at`, [username, email, hashedPassword]);
        return result.rows[0];
    }
    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const result = await (0, database_1.query)(`SELECT id, username, email, password_hash, profile_picture, created_at, updated_at
       FROM users
       WHERE email = $1`, [email]);
        return result.rows[0] || null;
    }
    /**
     * Find user by email or username (for login)
     */
    static async findByEmailOrUsername(identifier) {
        const result = await (0, database_1.query)(`SELECT id, username, email, password_hash, profile_picture, created_at, updated_at
       FROM users
       WHERE email = $1 OR username = $1`, [identifier]);
        return result.rows[0] || null;
    }
    /**
     * Find user by ID
     */
    static async findById(id) {
        const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }
    /**
     * Find user by username
     */
    static async findByUsername(username) {
        const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE username = $1`, [username]);
        return result.rows[0] || null;
    }
    /**
     * Search users by username
     */
    static async searchByUsername(searchTerm, limit = 20, excludeUserId) {
        if (excludeUserId) {
            const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
         FROM users
         WHERE username ILIKE $1 AND id != $2
         ORDER BY username
         LIMIT $3`, [`%${searchTerm}%`, excludeUserId, limit]);
            return result.rows;
        }
        const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE username ILIKE $1
       ORDER BY username
       LIMIT $2`, [`%${searchTerm}%`, limit]);
        return result.rows;
    }
    /**
     * Update user profile
     */
    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (updates.username) {
            fields.push(`username = $${paramCount++}`);
            values.push(updates.username);
        }
        if (updates.email) {
            fields.push(`email = $${paramCount++}`);
            values.push(updates.email);
        }
        if (updates.profile_picture !== undefined) {
            fields.push(`profile_picture = $${paramCount++}`);
            values.push(updates.profile_picture);
        }
        if (fields.length === 0) {
            return this.findById(id);
        }
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);
        const result = await (0, database_1.query)(`UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, email, profile_picture, created_at, updated_at`, values);
        return result.rows[0] || null;
    }
    /**
     * Verify password
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        return bcrypt_1.default.compare(plainPassword, hashedPassword);
    }
    /**
     * Check if user exists by email or username
     */
    static async exists(email, username) {
        const result = await (0, database_1.query)(`SELECT id FROM users WHERE email = $1 OR username = $2`, [email, username]);
        return result.rows.length > 0;
    }
    /**
     * Get follower count
     */
    static async getFollowerCount(userId) {
        const result = await (0, database_1.query)(`SELECT COUNT(*) as count FROM follows WHERE following_id = $1`, [userId]);
        return parseInt(result.rows[0].count);
    }
    /**
     * Get following count
     */
    static async getFollowingCount(userId) {
        const result = await (0, database_1.query)(`SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`, [userId]);
        return parseInt(result.rows[0].count);
    }
    /**
     * Get recent users (for discovery when no search query)
     */
    static async getRecentUsers(limit = 20, excludeUserId) {
        if (excludeUserId) {
            const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
         FROM users
         WHERE id != $1
         ORDER BY created_at DESC
         LIMIT $2`, [excludeUserId, limit]);
            return result.rows;
        }
        const result = await (0, database_1.query)(`SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1`, [limit]);
        return result.rows;
    }
}
exports.UserModel = UserModel;
