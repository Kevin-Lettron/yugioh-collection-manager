"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowModel = void 0;
const database_1 = require("../config/database");
class FollowModel {
    /**
     * Follow a user
     */
    static async follow(followerId, followingId) {
        if (followerId === followingId) {
            return null; // Cannot follow yourself
        }
        try {
            const result = await (0, database_1.query)(`INSERT INTO follows (follower_id, following_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, following_id) DO NOTHING
         RETURNING *`, [followerId, followingId]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('Error following user:', error);
            return null;
        }
    }
    /**
     * Unfollow a user
     */
    static async unfollow(followerId, followingId) {
        const result = await (0, database_1.query)(`DELETE FROM follows WHERE follower_id = $1 AND following_id = $2 RETURNING id`, [followerId, followingId]);
        return result.rows.length > 0;
    }
    /**
     * Check if user is following another user
     */
    static async isFollowing(followerId, followingId) {
        const result = await (0, database_1.query)(`SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`, [followerId, followingId]);
        return result.rows.length > 0;
    }
    /**
     * Get list of followers for a user
     */
    static async getFollowers(userId, limit = 50, offset = 0) {
        // Get total count
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM follows WHERE following_id = $1`, [userId]);
        const total = parseInt(countResult.rows[0].count);
        // Get followers with user details
        const result = await (0, database_1.query)(`SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at, f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return {
            followers: result.rows,
            total,
        };
    }
    /**
     * Get list of users that a user is following
     */
    static async getFollowing(userId, limit = 50, offset = 0) {
        // Get total count
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM follows WHERE follower_id = $1`, [userId]);
        const total = parseInt(countResult.rows[0].count);
        // Get following with user details
        const result = await (0, database_1.query)(`SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at, f.created_at as followed_at
       FROM follows f
       JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`, [userId, limit, offset]);
        return {
            following: result.rows,
            total,
        };
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
     * Get mutual followers (users who both follow each other)
     */
    static async getMutualFollowers(userId) {
        const result = await (0, database_1.query)(`SELECT u.id, u.username, u.email, u.profile_picture, u.created_at, u.updated_at
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
       ORDER BY u.username`, [userId]);
        return result.rows;
    }
}
exports.FollowModel = FollowModel;
