import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { DeckCommentModel } from '../models/deckCommentModel';
import { DeckModel } from '../models/deckModel';
import { NotificationModel } from '../models/notificationModel';

export class CommentController {
  /**
   * Create a comment on a deck
   */
  static async createComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { content, parent_comment_id } = req.body;

      // Get deckId from URL param or from parent comment (for replies via /:commentId/reply)
      let deckId: number;
      let parentCommentIdToUse = parent_comment_id;

      if (req.params.deckId) {
        // Route: /deck/:deckId
        deckId = parseInt(req.params.deckId);
      } else if (req.params.commentId) {
        // Route: /:commentId/reply - get deckId from parent comment
        const parentId = parseInt(req.params.commentId);
        if (isNaN(parentId)) {
          throw new ValidationError('Invalid comment ID');
        }
        const parentComment = await DeckCommentModel.findById(parentId);
        if (!parentComment) {
          throw new NotFoundError('Parent comment not found');
        }
        deckId = parentComment.deck_id;
        parentCommentIdToUse = parentId; // Use the commentId from URL as parent
      } else {
        throw new ValidationError('Invalid request');
      }

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      if (!content || content.trim().length === 0) {
        throw new ValidationError('Comment content is required');
      }

      if (content.length > 1000) {
        throw new ValidationError('Comment content cannot exceed 1000 characters');
      }

      // Check if deck exists
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Check if deck is public or owned by user
      if (!deck.is_public && deck.user_id !== req.user.id) {
        throw new ForbiddenError('You cannot comment on a private deck');
      }

      // If replying to a comment from body, verify parent exists
      if (parent_comment_id && !req.params.commentId) {
        const parentComment = await DeckCommentModel.findById(parent_comment_id);
        if (!parentComment) {
          throw new NotFoundError('Parent comment not found');
        }
        if (parentComment.deck_id !== deckId) {
          throw new ValidationError('Parent comment does not belong to this deck');
        }
      }

      const comment = await DeckCommentModel.create(
        req.user.id,
        deckId,
        content.trim(),
        parentCommentIdToUse
      );

      // Create notification
      if (parentCommentIdToUse) {
        // Notification for reply to comment
        const parentComment = await DeckCommentModel.findById(parentCommentIdToUse);
        if (parentComment && parentComment.user_id !== req.user.id) {
          const notificationExists = await NotificationModel.exists(
            parentComment.user_id,
            'reply',
            req.user.id,
            deckId,
            comment.id
          );
          if (!notificationExists) {
            await NotificationModel.create(
              parentComment.user_id,
              'reply',
              req.user.id,
              deckId,
              comment.id
            );
          }
        }
      } else {
        // Notification for comment on deck
        if (deck.user_id !== req.user.id) {
          const notificationExists = await NotificationModel.exists(
            deck.user_id,
            'comment',
            req.user.id,
            deckId,
            comment.id
          );
          if (!notificationExists) {
            await NotificationModel.create(
              deck.user_id,
              'comment',
              req.user.id,
              deckId,
              comment.id
            );
          }
        }
      }

      loggers.social.comment(req.user.id, deckId, comment.id);

      res.status(201).json({
        message: 'Comment created successfully',
        comment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comments for a deck (top-level only, with pagination)
   */
  static async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deckId = parseInt(req.params.deckId);
      const { page = 1, limit = 50 } = req.query;

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      // Check if deck exists
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Check if deck is public
      const authReq = req as AuthRequest;
      if (!deck.is_public && (!authReq.user || deck.user_id !== authReq.user.id)) {
        throw new ForbiddenError('You do not have permission to view comments on this deck');
      }

      // Get comments with nested replies
      const comments = await DeckCommentModel.getDeckCommentsWithReplies(deckId);

      res.json({
        comments: comments,
        total: comments.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get replies to a comment
   */
  static async getReplies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const commentId = parseInt(req.params.commentId);
      const { page = 1, limit = 50 } = req.query;

      if (isNaN(commentId)) {
        throw new ValidationError('Invalid comment ID');
      }

      // Check if comment exists
      const comment = await DeckCommentModel.findById(commentId);
      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      // Check if deck is public
      const deck = await DeckModel.findById(comment.deck_id);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      const authReq = req as AuthRequest;
      if (!deck.is_public && (!authReq.user || deck.user_id !== authReq.user.id)) {
        throw new ForbiddenError('You do not have permission to view replies on this deck');
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const result = await DeckCommentModel.getReplies(commentId, limitNum, offset);

      res.json({
        replies: result.replies,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(result.total / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a comment
   */
  static async updateComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const commentId = parseInt(req.params.commentId);
      const { content } = req.body;

      if (isNaN(commentId)) {
        throw new ValidationError('Invalid comment ID');
      }

      if (!content || content.trim().length === 0) {
        throw new ValidationError('Comment content is required');
      }

      if (content.length > 1000) {
        throw new ValidationError('Comment content cannot exceed 1000 characters');
      }

      const updatedComment = await DeckCommentModel.update(commentId, req.user.id, content.trim());

      if (!updatedComment) {
        throw new NotFoundError('Comment not found or you do not have permission to edit it');
      }

      res.json({
        message: 'Comment updated successfully',
        comment: updatedComment,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const commentId = parseInt(req.params.commentId);

      if (isNaN(commentId)) {
        throw new ValidationError('Invalid comment ID');
      }

      const deleted = await DeckCommentModel.delete(commentId, req.user.id);

      if (!deleted) {
        throw new NotFoundError('Comment not found or you do not have permission to delete it');
      }

      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
