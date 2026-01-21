"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const deckModel_1 = require("../models/deckModel");
const cardModel_1 = require("../models/cardModel");
class DeckController {
    /**
     * Create a new deck
     */
    static async createDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { name, respect_banlist = true, is_public = true, cover_image } = req.body;
            // Validate input
            if (!name || name.trim().length === 0) {
                throw new errorHandler_1.ValidationError('Deck name is required');
            }
            if (name.length > 100) {
                throw new errorHandler_1.ValidationError('Deck name cannot exceed 100 characters');
            }
            const deck = await deckModel_1.DeckModel.create(req.user.id, name.trim(), respect_banlist, is_public, cover_image);
            logger_1.loggers.deck.created(deck.id, req.user.id, deck.name);
            res.status(201).json({
                message: 'Deck created successfully',
                deck,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's decks with filters
     */
    static async getUserDecks(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { page = 1, limit = 20, search, respect_banlist } = req.query;
            const filters = {
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                respect_banlist: respect_banlist ? respect_banlist === 'true' : undefined,
            };
            const result = await deckModel_1.DeckModel.getUserDecks(req.user.id, filters);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get deck by ID with full details
     */
    static async getDeckById(req, res, next) {
        try {
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const deck = await deckModel_1.DeckModel.findById(deckId, req.user?.id);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Check if user can view this deck
            if (!deck.is_public && (!req.user || deck.user_id !== req.user.id)) {
                throw new errorHandler_1.ForbiddenError('You do not have permission to view this deck');
            }
            res.json({ deck });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update deck properties
     */
    static async updateDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const { name, respect_banlist, is_public, cover_image } = req.body;
            const updates = {};
            if (name !== undefined) {
                if (name.trim().length === 0) {
                    throw new errorHandler_1.ValidationError('Deck name cannot be empty');
                }
                if (name.length > 100) {
                    throw new errorHandler_1.ValidationError('Deck name cannot exceed 100 characters');
                }
                updates.name = name.trim();
            }
            if (respect_banlist !== undefined)
                updates.respect_banlist = respect_banlist;
            if (is_public !== undefined)
                updates.is_public = is_public;
            if (cover_image !== undefined)
                updates.cover_image = cover_image;
            const updatedDeck = await deckModel_1.DeckModel.update(deckId, req.user.id, updates);
            if (!updatedDeck) {
                throw new errorHandler_1.NotFoundError('Deck not found or you do not have permission to update it');
            }
            logger_1.loggers.deck.updated(deckId, req.user.id);
            res.json({
                message: 'Deck updated successfully',
                deck: updatedDeck,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete deck
     */
    static async deleteDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const deleted = await deckModel_1.DeckModel.delete(deckId, req.user.id);
            if (!deleted) {
                throw new errorHandler_1.NotFoundError('Deck not found or you do not have permission to delete it');
            }
            logger_1.loggers.deck.deleted(deckId, req.user.id);
            res.json({ message: 'Deck deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Add card to deck
     */
    static async addCardToDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            const { card_id, quantity = 1, is_extra_deck = false } = req.body;
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            if (!card_id) {
                throw new errorHandler_1.ValidationError('card_id is required');
            }
            if (quantity < 1 || quantity > 3) {
                throw new errorHandler_1.ValidationError('quantity must be between 1 and 3');
            }
            // Get card details
            const card = await cardModel_1.CardModel.findById(card_id);
            if (!card) {
                throw new errorHandler_1.NotFoundError('Card not found');
            }
            const result = await deckModel_1.DeckModel.addCard(deckId, req.user.id, card_id, quantity, is_extra_deck, card);
            if (!result.success) {
                throw new errorHandler_1.ValidationError(result.error || 'Failed to add card to deck');
            }
            res.status(201).json({
                message: 'Card added to deck successfully',
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Clear all cards from deck
     */
    static async clearDeckCards(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const cleared = await deckModel_1.DeckModel.clearCards(deckId, req.user.id);
            if (!cleared) {
                throw new errorHandler_1.NotFoundError('Deck not found or you do not have permission');
            }
            res.json({ message: 'All cards removed from deck successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove card from deck
     */
    static async removeCardFromDeck(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            const deckCardId = parseInt(req.params.cardId);
            if (isNaN(deckId) || isNaN(deckCardId)) {
                throw new errorHandler_1.ValidationError('Invalid deck or card ID');
            }
            const removed = await deckModel_1.DeckModel.removeCard(deckId, req.user.id, deckCardId);
            if (!removed) {
                throw new errorHandler_1.NotFoundError('Card not found in deck or you do not have permission');
            }
            res.json({ message: 'Card removed from deck successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update card quantity in deck
     */
    static async updateCardQuantity(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            const deckCardId = parseInt(req.params.cardId);
            const { quantity } = req.body;
            if (isNaN(deckId) || isNaN(deckCardId)) {
                throw new errorHandler_1.ValidationError('Invalid deck or card ID');
            }
            if (quantity === undefined || quantity < 0 || quantity > 3) {
                throw new errorHandler_1.ValidationError('quantity must be between 0 and 3');
            }
            // Get card details for validation
            const deck = await deckModel_1.DeckModel.findById(deckId, req.user.id);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Deck not found');
            }
            // Find the card in the deck
            const allCards = [...(deck.main_deck || []), ...(deck.extra_deck || [])];
            const deckCard = allCards.find((dc) => dc.id === deckCardId);
            if (!deckCard || !deckCard.card) {
                throw new errorHandler_1.NotFoundError('Card not found in deck');
            }
            const result = await deckModel_1.DeckModel.updateCardQuantity(deckId, req.user.id, deckCardId, quantity, deckCard.card);
            if (!result.success) {
                throw new errorHandler_1.ValidationError(result.error || 'Failed to update card quantity');
            }
            res.json({ message: 'Card quantity updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Validate deck (check if it meets Yu-Gi-Oh rules)
     */
    static async validateDeck(req, res, next) {
        try {
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const validation = await deckModel_1.DeckModel.validateDeck(deckId);
            if (!validation.valid) {
                logger_1.loggers.deck.validationError(deckId, validation.errors);
            }
            res.json({
                valid: validation.valid,
                errors: validation.errors,
                mainDeckCount: validation.mainDeckCount,
                extraDeckCount: validation.extraDeckCount,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Generate share link for a deck
     */
    static async generateShareLink(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const shareToken = await deckModel_1.DeckModel.generateShareToken(deckId, req.user.id);
            if (!shareToken) {
                throw new errorHandler_1.NotFoundError('Deck not found or you do not have permission');
            }
            res.json({
                message: 'Share link generated successfully',
                share_token: shareToken,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove share link for a deck
     */
    static async removeShareLink(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const deckId = parseInt(req.params.id);
            if (isNaN(deckId)) {
                throw new errorHandler_1.ValidationError('Invalid deck ID');
            }
            const removed = await deckModel_1.DeckModel.removeShareToken(deckId, req.user.id);
            if (!removed) {
                throw new errorHandler_1.NotFoundError('Deck not found or you do not have permission');
            }
            res.json({ message: 'Share link removed successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get deck by share token (guest access - no auth required)
     */
    static async getSharedDeck(req, res, next) {
        try {
            const { shareToken } = req.params;
            if (!shareToken) {
                throw new errorHandler_1.ValidationError('Share token is required');
            }
            const deck = await deckModel_1.DeckModel.findByShareToken(shareToken);
            if (!deck) {
                throw new errorHandler_1.NotFoundError('Shared deck not found or link has expired');
            }
            res.json({ deck });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get public decks (search)
     */
    static async getPublicDecks(req, res, next) {
        try {
            const { page = 1, limit = 20, search, respect_banlist, user_id } = req.query;
            const filters = {
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                respect_banlist: respect_banlist ? respect_banlist === 'true' : undefined,
                user_id: user_id ? parseInt(user_id) : undefined,
            };
            // Get requesting user ID if authenticated
            const authReq = req;
            const requestingUserId = authReq.user?.id;
            const result = await deckModel_1.DeckModel.searchPublicDecks(filters, requestingUserId);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DeckController = DeckController;
