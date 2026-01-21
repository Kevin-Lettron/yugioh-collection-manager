"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckCommentModel = void 0;
const database_1 = require("../config/database");
class DeckCommentModel {
    /**
     * Create a comment
     */
    static async create(userId, deckId, content, parentCommentId) {
        const result = await (0, database_1.query)(`INSERT INTO deck_comments (user_id, deck_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [userId, deckId, content, parentCommentId || null]);
        return this.parseComment(result.rows[0]);
    }
    /**
     * Get comment by ID
     */
    static async findById(commentId) {
        const result = await (0, database_1.query)(`SELECT dc.*, u.id as user_id, u.username, u.profile_picture
       FROM deck_comments dc
       JOIN users u ON dc.user_id = u.id
       WHERE dc.id = $1`, [commentId]);
        return result.rows[0] ? this.parseComment(result.rows[0]) : null;
    }
    /**
     * Get comments for a deck (top-level only)
     */
    static async getDeckComments(deckId, limit = 50, offset = 0) {
        // Get total count of top-level comments
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM deck_comments WHERE deck_id = $1 AND parent_comment_id IS NULL`, [deckId]);
        const total = parseInt(countResult.rows[0].count);
        // Get top-level comments
        const result = await (0, database_1.query)(`SELECT dc.*, u.id as user_id, u.username, u.profile_picture,
              (SELECT COUNT(*) FROM deck_comments WHERE parent_comment_id = dc.id) as reply_count
       FROM deck_comments dc
       JOIN users u ON dc.user_id = u.id
       WHERE dc.deck_id = $1 AND dc.parent_comment_id IS NULL
       ORDER BY dc.created_at DESC
       LIMIT $2 OFFSET $3`, [deckId, limit, offset]);
        const comments = result.rows.map((row) => ({
            ...this.parseComment(row),
            reply_count: parseInt(row.reply_count || 0),
        }));
        return { comments, total };
    }
    /**
     * Get replies to a comment (with pagination)
     */
    static async getReplies(parentCommentId, limit = 50, offset = 0) {
        // Get total count of replies
        const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM deck_comments WHERE parent_comment_id = $1`, [parentCommentId]);
        const total = parseInt(countResult.rows[0].count);
        // Get replies
        const result = await (0, database_1.query)(`SELECT dc.*, u.id as user_id, u.username, u.profile_picture
       FROM deck_comments dc
       JOIN users u ON dc.user_id = u.id
       WHERE dc.parent_comment_id = $1
       ORDER BY dc.created_at ASC
       LIMIT $2 OFFSET $3`, [parentCommentId, limit, offset]);
        const replies = result.rows.map((row) => this.parseComment(row));
        return { replies, total };
    }
    /**
     * Get all comments for a deck with nested replies
     */
    static async getDeckCommentsWithReplies(deckId) {
        // Get all comments (both top-level and replies)
        const result = await (0, database_1.query)(`SELECT dc.*, u.id as user_id, u.username, u.profile_picture
       FROM deck_comments dc
       JOIN users u ON dc.user_id = u.id
       WHERE dc.deck_id = $1
       ORDER BY dc.created_at ASC`, [deckId]);
        const comments = result.rows.map((row) => this.parseComment(row));
        // Build comment tree
        const commentMap = new Map();
        const topLevelComments = [];
        // First pass: create map of all comments
        comments.forEach((comment) => {
            comment.replies = [];
            commentMap.set(comment.id, comment);
        });
        // Second pass: build tree structure
        comments.forEach((comment) => {
            if (comment.parent_comment_id) {
                const parent = commentMap.get(comment.parent_comment_id);
                if (parent) {
                    parent.replies.push(comment);
                }
            }
            else {
                topLevelComments.push(comment);
            }
        });
        return topLevelComments;
    }
    /**
     * Update comment
     */
    static async update(commentId, userId, content) {
        const result = await (0, database_1.query)(`UPDATE deck_comments
       SET content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`, [content, commentId, userId]);
        if (result.rows.length === 0)
            return null;
        return this.findById(commentId);
    }
    /**
     * Delete comment
     */
    static async delete(commentId, userId) {
        // Note: This will cascade delete all replies due to ON DELETE CASCADE in schema
        const result = await (0, database_1.query)(`DELETE FROM deck_comments WHERE id = $1 AND user_id = $2 RETURNING id`, [commentId, userId]);
        return result.rows.length > 0;
    }
    /**
     * Get comment count for a deck
     */
    static async getCommentCount(deckId) {
        const result = await (0, database_1.query)(`SELECT COUNT(*) as count FROM deck_comments WHERE deck_id = $1`, [deckId]);
        return parseInt(result.rows[0].count);
    }
    /**
     * Parse comment from database row
     */
    static parseComment(row) {
        return {
            id: row.id,
            user_id: row.user_id,
            deck_id: row.deck_id,
            parent_comment_id: row.parent_comment_id,
            content: row.content,
            created_at: row.created_at,
            updated_at: row.updated_at,
            user: {
                id: row.user_id,
                username: row.username,
                profile_picture: row.profile_picture,
            },
        };
    }
}
exports.DeckCommentModel = DeckCommentModel;
