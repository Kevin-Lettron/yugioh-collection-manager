import { query } from '../config/database';
import { User } from '../../../shared/types';
import bcrypt from 'bcrypt';

export class UserModel {
  /**
   * Create a new user
   */
  static async create(username: string, email: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, profile_picture, created_at, updated_at`,
      [username, email, hashedPassword]
    );

    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
    const result = await query(
      `SELECT id, username, email, password_hash, profile_picture, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by email or username (for login)
   */
  static async findByEmailOrUsername(identifier: string): Promise<(User & { password_hash: string }) | null> {
    const result = await query(
      `SELECT id, username, email, password_hash, profile_picture, created_at, updated_at
       FROM users
       WHERE email = $1 OR username = $1`,
      [identifier]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  static async findById(id: number): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username: string): Promise<User | null> {
    const result = await query(
      `SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE username = $1`,
      [username]
    );

    return result.rows[0] || null;
  }

  /**
   * Search users by username
   */
  static async searchByUsername(searchTerm: string, limit: number = 20, excludeUserId?: number): Promise<User[]> {
    if (excludeUserId) {
      const result = await query(
        `SELECT id, username, email, profile_picture, created_at, updated_at
         FROM users
         WHERE username ILIKE $1 AND id != $2
         ORDER BY username
         LIMIT $3`,
        [`%${searchTerm}%`, excludeUserId, limit]
      );
      return result.rows;
    }

    const result = await query(
      `SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       WHERE username ILIKE $1
       ORDER BY username
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );

    return result.rows;
  }

  /**
   * Update user profile
   */
  static async update(id: number, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
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

    const result = await query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, username, email, profile_picture, created_at, updated_at`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Check if user exists by email or username
   */
  static async exists(email: string, username: string): Promise<boolean> {
    const result = await query(
      `SELECT id FROM users WHERE email = $1 OR username = $2`,
      [email, username]
    );

    return result.rows.length > 0;
  }

  /**
   * Get follower count
   */
  static async getFollowerCount(userId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get following count
   */
  static async getFollowingCount(userId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Get recent users (for discovery when no search query)
   */
  static async getRecentUsers(limit: number = 20, excludeUserId?: number): Promise<User[]> {
    if (excludeUserId) {
      const result = await query(
        `SELECT id, username, email, profile_picture, created_at, updated_at
         FROM users
         WHERE id != $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [excludeUserId, limit]
      );
      return result.rows;
    }

    const result = await query(
      `SELECT id, username, email, profile_picture, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }
}
