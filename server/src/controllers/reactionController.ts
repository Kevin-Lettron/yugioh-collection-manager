import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { DeckReactionModel } from '../models/deckReactionModel';
import { DeckModel } from '../models/deckModel';
import { NotificationModel } from '../models/notificationModel';

export class ReactionController {
  /**
   * Like a deck
   */
  static async likeDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      // Check if deck exists
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Check if deck is public or owned by user
      if (!deck.is_public && deck.user_id !== req.user.id) {
        throw new ValidationError('You cannot like a private deck');
      }

      // Check current reaction
      const currentReaction = await DeckReactionModel.getUserReaction(req.user.id, deckId);

      if (currentReaction === 'like') {
        throw new ValidationError('You have already liked this deck');
      }

      // Add or update reaction
      const reaction = await DeckReactionModel.addReaction(req.user.id, deckId, true);

      // Create notification if this is a like on someone else's deck
      if (deck.user_id !== req.user.id) {
        const notificationExists = await NotificationModel.exists(
          deck.user_id,
          'like',
          req.user.id,
          deckId
        );
        if (!notificationExists) {
          await NotificationModel.create(deck.user_id, 'like', req.user.id, deckId);
        }
      }

      loggers.social.reaction(req.user.id, deckId, true);

      res.status(201).json({
        message: currentReaction === 'dislike' ? 'Reaction updated to like' : 'Deck liked',
        reaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dislike a deck
   */
  static async dislikeDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      // Check if deck exists
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Check if deck is public or owned by user
      if (!deck.is_public && deck.user_id !== req.user.id) {
        throw new ValidationError('You cannot dislike a private deck');
      }

      // Check current reaction
      const currentReaction = await DeckReactionModel.getUserReaction(req.user.id, deckId);

      if (currentReaction === 'dislike') {
        throw new ValidationError('You have already disliked this deck');
      }

      // Add or update reaction
      const reaction = await DeckReactionModel.addReaction(req.user.id, deckId, false);

      // Create notification if this is a dislike on someone else's deck
      if (deck.user_id !== req.user.id) {
        const notificationExists = await NotificationModel.exists(
          deck.user_id,
          'dislike',
          req.user.id,
          deckId
        );
        if (!notificationExists) {
          await NotificationModel.create(deck.user_id, 'dislike', req.user.id, deckId);
        }
      }

      loggers.social.reaction(req.user.id, deckId, false);

      res.status(201).json({
        message: currentReaction === 'like' ? 'Reaction updated to dislike' : 'Deck disliked',
        reaction,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove reaction (unlike/undislike)
   */
  static async removeReaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const removed = await DeckReactionModel.removeReaction(req.user.id, deckId);

      if (!removed) {
        throw new NotFoundError('No reaction found for this deck');
      }

      res.json({ message: 'Reaction removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get reaction counts for a deck
   */
  static async getReactionCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      // Check if deck exists
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      const counts = await DeckReactionModel.getReactionCounts(deckId);

      // Get user's reaction if authenticated
      const authReq = req as AuthRequest;
      let userReaction = null;
      if (authReq.user) {
        userReaction = await DeckReactionModel.getUserReaction(authReq.user.id, deckId);
      }

      res.json({
        likes: counts.likes,
        dislikes: counts.dislikes,
        user_reaction: userReaction,
      });
    } catch (error) {
      next(error);
    }
  }
}
