"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const followModel_1 = require("../models/followModel");
const wishlistModel_1 = require("../models/wishlistModel");
const userModel_1 = require("../models/userModel");
const deckModel_1 = require("../models/deckModel");
const notificationModel_1 = require("../models/notificationModel");
class SocialController {
    /**
     * Follow a user
     */
    static async followUser(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const followingId = parseInt(req.params.userId);
            if (isNaN(followingId)) {
                throw new errorHandler_1.ValidationError('Invalid user ID');
            }
            if (followingId === req.user.id) {
                throw new errorHandler_1.ValidationError('You cannot follow yourself');
            }
            // Check if user exists
            const userToFollow = await userModel_1.UserModel.findById(followingId);
            if (!userToFollow) {
                throw new errorHandler_1.NotFoundError('User not found');
            }
            // Check if already following
            const alreadyFollowing = await followModel_1.FollowModel.isFollowing(req.user.id, followingId);
            if (alreadyFollowing) {
                throw new errorHandler_1.ValidationError('You are already following this user');
            }
            const follow = await followModel_1.FollowModel.follow(req.user.id, followingId);
            if (!follow) {
                throw new Error('Failed to follow user');
            }
            // Create notification for the followed user
            const notificationExists = await notificationModel_1.NotificationModel.exists(followingId, 'follow', req.user.id);
            if (!notificationExists) {
                await notificationModel_1.NotificationModel.create(followingId, 'follow', req.user.id);
            }
            logger_1.loggers.social.follow(req.user.id, followingId);
            res.status(201).json({
                message: 'Successfully followed user',
                follow,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Unfollow a user
     */
    static async unfollowUser(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const followingId = parseInt(req.params.userId);
            if (isNaN(followingId)) {
                throw new errorHandler_1.ValidationError('Invalid user ID');
            }
            const unfollowed = await followModel_1.FollowModel.unfollow(req.user.id, followingId);
            if (!unfollowed) {
                throw new errorHandler_1.NotFoundError('You are not following this user');
            }
            logger_1.loggers.social.unfollow(req.user.id, followingId);
            res.json({ message: 'Successfully unfollowed user' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's followers
     */
    static async getFollowers(req, res, next) {
        try {
            // Use userId from params, or fall back to authenticated user
            let userId;
            if (req.params.userId) {
                userId = parseInt(req.params.userId);
                if (isNaN(userId)) {
                    throw new errorHandler_1.ValidationError('Invalid user ID');
                }
            }
            else if (req.user) {
                userId = req.user.id;
            }
            else {
                throw new errorHandler_1.ValidationError('User ID is required');
            }
            const { page = 1, limit = 50 } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await followModel_1.FollowModel.getFollowers(userId, limitNum, offset);
            res.json({
                followers: result.followers,
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
     * Get users that a user is following
     */
    static async getFollowing(req, res, next) {
        try {
            // Use userId from params, or fall back to authenticated user
            let userId;
            if (req.params.userId) {
                userId = parseInt(req.params.userId);
                if (isNaN(userId)) {
                    throw new errorHandler_1.ValidationError('Invalid user ID');
                }
            }
            else if (req.user) {
                userId = req.user.id;
            }
            else {
                throw new errorHandler_1.ValidationError('User ID is required');
            }
            const { page = 1, limit = 50 } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await followModel_1.FollowModel.getFollowing(userId, limitNum, offset);
            res.json({
                following: result.following,
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
     * Add deck to wishlist
     */
    static async addToWishlist(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            // Check if deck exists and is public
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            if (!deck.is_public && deck.user_id !== req.user.id) {
                throw new errorHandler_1.ValidationError('You cannot wishlist a private deck');
            }
            // Check if already in wishlist
            const alreadyWishlisted = await wishlistModel_1.WishlistModel.isInWishlist(req.user.id, deckId);
            if (alreadyWishlisted) {
                throw new errorHandler_1.ValidationError('Deck is already in your wishlist');
            }
            const wishlist = await wishlistModel_1.WishlistModel.addToWishlist(req.user.id, deckId);
            if (!wishlist) {
                throw new Error('Failed to add deck to wishlist');
            }
            res.status(201).json({
                message: 'Deck added to wishlist',
                wishlist,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove deck from wishlist
     */
    static async removeFromWishlist(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const removed = await wishlistModel_1.WishlistModel.removeFromWishlist(req.user.id, deckId);
            if (!removed) {
                throw new errorHandler_1.NotFoundError('Deck not found in wishlist');
            }
            res.json({ message: 'Deck removed from wishlist' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's wishlist
     */
    static async getWishlist(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { page = 1, limit = 50 } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const result = await wishlistModel_1.WishlistModel.getUserWishlist(req.user.id, limitNum, offset);
            res.json({
                wishlists: result.wishlists,
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
}
exports.SocialController = SocialController;
