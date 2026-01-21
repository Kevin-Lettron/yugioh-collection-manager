"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const deckCommentModel_1 = require("../models/deckCommentModel");
const deckModel_1 = require("../models/deckModel");
const notificationModel_1 = require("../models/notificationModel");
class CommentController {
    /**
     * Create a comment on a deck
     */
    static async createComment(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            const { content, parent_comment_id } = req.body;
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            if (!content || content.trim().length === 0) {
                throw new errorHandler_1.ValidationError('Comment content is required');
            }
            if (content.length > 1000) {
                throw new errorHandler_1.ValidationError('Comment content cannot exceed 1000 characters');
            }
            // Check if deck exists
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Check if deck is public or owned by user
            if (!deck.is_public && deck.user_id !== req.user.id) {
                throw new errorHandler_1.ForbiddenError('You cannot comment on a private deck');
            }
            // If replying to a comment, verify parent exists
            if (parent_comment_id) {
                const parentComment = await deckCommentModel_1.DeckCommentModel.findById(parent_comment_id);
                if (!parentComment) {
                    throw new errorHandler_1.NotFoundError('Parent comment not found');
                }
                if (parentComment.deck_id !== deckId) {
                    throw new errorHandler_1.ValidationError('Parent comment does not belong to this deck');
                }
            }
            const comment = await deckCommentModel_1.DeckCommentModel.create(req.user.id, deckId, content.trim(), parent_comment_id);
            // Create notification
            if (parent_comment_id) {
                // Notification for reply to comment
                const parentComment = await deckCommentModel_1.DeckCommentModel.findById(parent_comment_id);
                if (parentComment && parentComment.user_id !== req.user.id) {
                    const notificationExists = await notificationModel_1.NotificationModel.exists(parentComment.user_id, 'reply', req.user.id, deckId, comment.id);
                    if (!notificationExists) {
                        await notificationModel_1.NotificationModel.create(parentComment.user_id, 'reply', req.user.id, deckId, comment.id);
                    }
                }
            }
            else {
                // Notification for comment on deck
                if (deck.user_id !== req.user.id) {
                    const notificationExists = await notificationModel_1.NotificationModel.exists(deck.user_id, 'comment', req.user.id, deckId, comment.id);
                    if (!notificationExists) {
                        await notificationModel_1.NotificationModel.create(deck.user_id, 'comment', req.user.id, deckId, comment.id);
                    }
                }
            }
            logger_1.loggers.social.comment(req.user.id, deckId, comment.id);
            res.status(201).json({
                message: 'Comment created successfully',
                comment,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get comments for a deck (top-level only, with pagination)
     */
    static async getComments(req, res, next) {
        try {
            const deckId = parseInt(req.params.deckId);
            const { page = 1, limit = 50 } = req.query;
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            // Check if deck exists
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Check if deck is public
            const authReq = req;
            if (!deck.is_public && (!authReq.user || deck.user_id !== authReq.user.id)) {
                throw new errorHandler_1.ForbiddenError('You do not have permission to view comments on this deck');
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await deckCommentModel_1.DeckCommentModel.getDeckComments(deckId, limitNum, offset);
            res.json({
                comments: result.comments,
                total: result.total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(result.total / limitNum),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get replies to a comment
     */
    static async getReplies(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const { page = 1, limit = 50 } = req.query;
            if (isNaN(commentId)) {
                throw new errorHandler_1.ValidationError('Invalid comment ID');
            }
            // Check if comment exists
            const comment = await deckCommentModel_1.DeckCommentModel.findById(commentId);
            if (!comment) {
                throw new errorHandler_1.NotFoundError('Comment not found');
            }
            // Check if deck is public
            const deck = await deckModel_1.DeckModel.findById(comment.deck_id);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            const authReq = req;
            if (!deck.is_public && (!authReq.user || deck.user_id !== authReq.user.id)) {
                throw new errorHandler_1.ForbiddenError('You do not have permission to view replies on this deck');
            }
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await deckCommentModel_1.DeckCommentModel.getReplies(commentId, limitNum, offset);
            res.json({
                replies: result.replies,
                total: result.total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(result.total / limitNum),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update a comment
     */
    static async updateComment(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const commentId = parseInt(req.params.commentId);
            const { content } = req.body;
            if (isNaN(commentId)) {
                throw new errorHandler_1.ValidationError('Invalid comment ID');
            }
            if (!content || content.trim().length === 0) {
                throw new errorHandler_1.ValidationError('Comment content is required');
            }
            if (content.length > 1000) {
                throw new errorHandler_1.ValidationError('Comment content cannot exceed 1000 characters');
            }
            const updatedComment = await deckCommentModel_1.DeckCommentModel.update(commentId, req.user.id, content.trim());
            if (!updatedComment) {
                throw new errorHandler_1.NotFoundError('Comment not found or you do not have permission to edit it');
            }
            res.json({
                message: 'Comment updated successfully',
                comment: updatedComment,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete a comment
     */
    static async deleteComment(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const commentId = parseInt(req.params.commentId);
            if (isNaN(commentId)) {
                throw new errorHandler_1.ValidationError('Invalid comment ID');
            }
            const deleted = await deckCommentModel_1.DeckCommentModel.delete(commentId, req.user.id);
            if (!deleted) {
                throw new errorHandler_1.NotFoundError('Comment not found or you do not have permission to delete it');
            }
            res.json({ message: 'Comment deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CommentController = CommentController;
