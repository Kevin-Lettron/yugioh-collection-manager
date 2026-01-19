import { query } from '../config/database';
import { Follow, User } from '../../../shared/types';

export class FollowModel {
  /**
   * Follow a user
   */
  static async follow(followerId: number, followingId: number): Promise<Follow | null> {
    if (followerId === followingId) {
      return null; // Cannot follow yourself
    }

    try {
      const result = await query(
        `INSERT INTO follows (follower_id, following_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, following_id) DO NOTHING
         RETURNING *`,
        [followerId, followingId]
      );

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error following user:', error);
      return null;
    }
  }

  /**
   * Unfollow a user
   */
  static async unfollow(followerId: number, followingId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id`,
      [followerId, followingId]
    );

    return result.rows.length > 0;
  }

  /**
   * Check if user is following another user
   */
  static async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const result = await query(
      `SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get list of followers for a user
   */
  static async getFollowers(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ followers: User[]; total: number }> {
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM follows WHERE following_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get followers with user details
    const result = await query(
      `SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at, f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      followers: result.rows,
      total,
    };
  }

  /**
   * Get list of users that a user is following
   */
  static async getFollowing(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ following: User[]; total: number }> {
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get following with user details
    const result = await query(
      `SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at, f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      following: result.rows,
      total,
    };
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
   * Get mutual followers (users who both follow each other)
   */
  static async getMutualFollowers(userId: number): Promise<User[]> {
    const result = await query(
      `SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at
       FROM users u
       WHERE u.id IN (
         SELECT f1.following_id
         FROM follows f1
         WHERE f1.follower_id = $1
         AND EXISTS (
           SELECT 1 FROM follows f2
           WHERE f2.follower_id = f1.following_id
           AND f2.following_id = $1
         )
       )
       ORDER BY u.username`,
      [userId]
    );

    return result.rows;
  }
}
