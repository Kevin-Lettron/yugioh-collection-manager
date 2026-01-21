"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const deckReactionModel_1 = require("../models/deckReactionModel");
const deckModel_1 = require("../models/deckModel");
const notificationModel_1 = require("../models/notificationModel");
class ReactionController {
    /**
     * Like a deck
     */
    static async likeDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            // Check if deck exists
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Check if deck is public or owned by user
            if (!deck.is_public && deck.user_id !== req.user.id) {
                throw new errorHandler_1.ValidationError('You cannot like a private deck');
            }
            // Check current reaction
            const currentReaction = await deckReactionModel_1.DeckReactionModel.getUserReaction(req.user.id, deckId);
            if (currentReaction === 'like') {
                throw new errorHandler_1.ValidationError('You have already liked this deck');
            }
            // Add or update reaction
            const reaction = await deckReactionModel_1.DeckReactionModel.addReaction(req.user.id, deckId, true);
            // Create notification if this is a like on someone else's deck
            if (deck.user_id !== req.user.id) {
                const notificationExists = await notificationModel_1.NotificationModel.exists(deck.user_id, 'like', req.user.id, deckId);
                if (!notificationExists) {
                    await notificationModel_1.NotificationModel.create(deck.user_id, 'like', req.user.id, deckId);
                }
            }
            logger_1.loggers.social.reaction(req.user.id, deckId, true);
            res.status(201).json({
                message: currentReaction === 'dislike' ? 'Reaction updated to like' : 'Deck liked',
                reaction,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Dislike a deck
     */
    static async dislikeDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            // Check if deck exists
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Check if deck is public or owned by user
            if (!deck.is_public && deck.user_id !== req.user.id) {
                throw new errorHandler_1.ValidationError('You cannot dislike a private deck');
            }
            // Check current reaction
            const currentReaction = await deckReactionModel_1.DeckReactionModel.getUserReaction(req.user.id, deckId);
            if (currentReaction === 'dislike') {
                throw new errorHandler_1.ValidationError('You have already disliked this deck');
            }
            // Add or update reaction
            const reaction = await deckReactionModel_1.DeckReactionModel.addReaction(req.user.id, deckId, false);
            // Create notification if this is a dislike on someone else's deck
            if (deck.user_id !== req.user.id) {
                const notificationExists = await notificationModel_1.NotificationModel.exists(deck.user_id, 'dislike', req.user.id, deckId);
                if (!notificationExists) {
                    await notificationModel_1.NotificationModel.create(deck.user_id, 'dislike', req.user.id, deckId);
                }
            }
            logger_1.loggers.social.reaction(req.user.id, deckId, false);
            res.status(201).json({
                message: currentReaction === 'like' ? 'Reaction updated to dislike' : 'Deck disliked',
                reaction,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove reaction (unlike/undislike)
     */
    static async removeReaction(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const removed = await deckReactionModel_1.DeckReactionModel.removeReaction(req.user.id, deckId);
            if (!removed) {
                throw new errorHandler_1.NotFoundError('No reaction found for this deck');
            }
            res.json({ message: 'Reaction removed successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get reaction counts for a deck
     */
    static async getReactionCounts(req, res, next) {
        try {
            const deckId = parseInt(req.params.deckId);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            // Check if deck exists
            const deck = await deckModel_1.DeckModel.findById(deckId);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            const counts = await deckReactionModel_1.DeckReactionModel.getReactionCounts(deckId);
            // Get user's reaction if authenticated
            const authReq = req;
            let userReaction = null;
            if (authReq.user) {
                userReaction = await deckReactionModel_1.DeckReactionModel.getUserReaction(authReq.user.id, deckId);
            }
            res.json({
                likes: counts.likes,
                dislikes: counts.dislikes,
                user_reaction: userReaction,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ReactionController = ReactionController;
