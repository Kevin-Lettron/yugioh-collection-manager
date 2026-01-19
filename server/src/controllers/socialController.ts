import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { FollowModel } from '../models/followModel';
import { WishlistModel } from '../models/wishlistModel';
import { UserModel } from '../models/userModel';
import { DeckModel } from '../models/deckModel';
import { NotificationModel } from '../models/notificationModel';

export class SocialController {
  /**
   * Follow a user
   */
  static async followUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const followingId = parseInt(req.params.userId);

      if (isNaN(followingId)) {
        throw new ValidationError('Invalid user ID');
      }

      if (followingId === req.user.id) {
        throw new ValidationError('You cannot follow yourself');
      }

      // Check if user exists
      const userToFollow = await UserModel.findById(followingId);
      if (!userToFollow) {
        throw new NotFoundError('User not found');
      }

      // Check if already following
      const alreadyFollowing = await FollowModel.isFollowing(req.user.id, followingId);
      if (alreadyFollowing) {
        throw new ValidationError('You are already following this user');
      }

      const follow = await FollowModel.follow(req.user.id, followingId);

      if (!follow) {
        throw new Error('Failed to follow user');
      }

      // Create notification for the followed user
      const notificationExists = await NotificationModel.exists(
        followingId,
        'follow',
        req.user.id
      );
      if (!notificationExists) {
        await NotificationModel.create(followingId, 'follow', req.user.id);
      }

      loggers.social.follow(req.user.id, followingId);

      res.status(201).json({
        message: 'Successfully followed user',
        follow,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unfollow a user
   */
  static async unfollowUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const followingId = parseInt(req.params.userId);

      if (isNaN(followingId)) {
        throw new ValidationError('Invalid user ID');
      }

      const unfollowed = await FollowModel.unfollow(req.user.id, followingId);

      if (!unfollowed) {
        throw new NotFoundError('You are not following this user');
      }

      loggers.social.unfollow(req.user.id, followingId);

      res.json({ message: 'Successfully unfollowed user' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's followers
   */
  static async getFollowers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const { page = 1, limit = 50 } = req.query;

      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const result = await FollowModel.getFollowers(userId, limitNum, offset);

      res.json({
        followers: result.followers,
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
   * Get users that a user is following
   */
  static async getFollowing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const { page = 1, limit = 50 } = req.query;

      if (isNaN(userId)) {
        throw new ValidationError('Invalid user ID');
      }

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const result = await FollowModel.getFollowing(userId, limitNum, offset);

      res.json({
        following: result.following,
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
   * Add deck to wishlist
   */
  static async addToWishlist(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      // Check if deck exists and is public
      const deck = await DeckModel.findById(deckId);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      if (!deck.is_public && deck.user_id !== req.user.id) {
        throw new ValidationError('You cannot wishlist a private deck');
      }

      // Check if already in wishlist
      const alreadyWishlisted = await WishlistModel.isInWishlist(req.user.id, deckId);
      if (alreadyWishlisted) {
        throw new ValidationError('Deck is already in your wishlist');
      }

      const wishlist = await WishlistModel.addToWishlist(req.user.id, deckId);

      if (!wishlist) {
        throw new Error('Failed to add deck to wishlist');
      }

      res.status(201).json({
        message: 'Deck added to wishlist',
        wishlist,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove deck from wishlist
   */
  static async removeFromWishlist(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.deckId);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const removed = await WishlistModel.removeFromWishlist(req.user.id, deckId);

      if (!removed) {
        throw new NotFoundError('Deck not found in wishlist');
      }

      res.json({ message: 'Deck removed from wishlist' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's wishlist
   */
  static async getWishlist(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { page = 1, limit = 50 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const result = await WishlistModel.getUserWishlist(req.user.id, limitNum, offset);

      res.json({
        wishlists: result.wishlists,
        total: result.total,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(result.total / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }
}
