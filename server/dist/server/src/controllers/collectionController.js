"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const userCardModel_1 = require("../models/userCardModel");
const cardModel_1 = require("../models/cardModel");
const ygoprodeckService_1 = require("../services/ygoprodeckService");
class CollectionController {
    /**
     * Search for a card by code (Card ID or Set Code)
     * Returns card info, available sets/rarities, and detected language
     */
    static async searchCard(req, res, next) {
        try {
            const { code } = req.query;
            if (!code || typeof code !== 'string') {
                throw new errorHandler_1.ValidationError('code parameter is required');
            }
            logger_1.loggers.external.request('YGOProDeck', `/cardinfo.php?code=${code}`);
            const result = await ygoprodeckService_1.YGOProDeckService.searchByCodeOrSetCode(code);
            if (!result.card) {
                const errorMessage = result.error ||
                    `Carte avec le code '${code}' non trouvée. Essayez d'utiliser le Code Set (ex: SDP-F037) situé sous l'illustration de la carte.`;
                throw new errorHandler_1.NotFoundError(errorMessage);
            }
            res.json({
                card: result.card,
                matchedSet: result.setInfo,
                availableSets: result.card.card_sets || [],
                detectedLanguage: result.detectedLanguage,
                originalSetCode: result.originalSetCode,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Add card to collection by set code or card ID
     * Fetches from YGOProDeck API, upserts to cards table, then adds to user's collection
     * Supports language detection from set code (e.g., LDK2-FRK40 -> French)
     */
    static async addCardByCode(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { card_code, set_code, rarity, quantity = 1, language } = req.body;
            // Validate input - now only set_code and rarity are required
            if (!set_code || !rarity) {
                throw new errorHandler_1.ValidationError('set_code and rarity are required');
            }
            if (quantity < 1 || quantity > 100) {
                throw new errorHandler_1.ValidationError('quantity must be between 1 and 100');
            }
            // Detect language from set code if not provided
            const cardLanguage = language || ygoprodeckService_1.YGOProDeckService.detectLanguageFromSetCode(set_code);
            let apiCard = null;
            let searchError;
            // If card_code is provided, try to fetch by ID first
            if (card_code) {
                logger_1.loggers.external.request('YGOProDeck', `/cardinfo.php?id=${card_code}`);
                apiCard = await ygoprodeckService_1.YGOProDeckService.getCardById(card_code);
            }
            // If no card found by ID or no card_code provided, try by set_code
            if (!apiCard) {
                logger_1.loggers.external.request('YGOProDeck', `/cardinfo.php?set=${set_code}`);
                const result = await ygoprodeckService_1.YGOProDeckService.getCardBySetCode(set_code);
                apiCard = result.card;
                searchError = result.error;
            }
            if (!apiCard) {
                const errorMessage = searchError ||
                    `Carte non trouvée. Essayez d'utiliser le Code Set (ex: SDP-F037) situé sous l'illustration de la carte.`;
                throw new errorHandler_1.NotFoundError(errorMessage);
            }
            // Normalize the set code for rarity validation (API only has English rarities)
            const normalizedSetCode = ygoprodeckService_1.YGOProDeckService.normalizeSetCode(set_code);
            const validRarities = ygoprodeckService_1.YGOProDeckService.getRaritiesForSetCode(apiCard, normalizedSetCode);
            if (validRarities.length > 0 && !validRarities.includes(rarity)) {
                throw new errorHandler_1.ValidationError(`Rareté '${rarity}' invalide pour le code '${set_code}'. Raretés valides : ${validRarities.join(', ')}`);
            }
            // Upsert card in database
            const card = await cardModel_1.CardModel.upsert(apiCard);
            // Add to user's collection with original set code and detected language
            const userCard = await userCardModel_1.UserCardModel.addToCollection(req.user.id, card.id, set_code.toUpperCase(), // Keep original set code (e.g., LDK2-FRK40)
            rarity, quantity, cardLanguage);
            logger_1.loggers.collection.cardAdded(req.user.id, card.id, quantity);
            res.status(201).json({
                message: 'Card added to collection',
                card: userCard,
                language: cardLanguage,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user's collection with filters and pagination
     */
    static async getUserCollection(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { page = 1, limit = 50, search, type, frame_type, rarity, level, min_atk, max_atk, min_def, max_def, attribute, race, } = req.query;
            const filters = {
                page: parseInt(page),
                limit: parseInt(limit),
                search: search,
                type: type,
                frame_type: frame_type,
                rarity: rarity,
                level: level ? parseInt(level) : undefined,
                min_atk: min_atk ? parseInt(min_atk) : undefined,
                max_atk: max_atk ? parseInt(max_atk) : undefined,
                min_def: min_def ? parseInt(min_def) : undefined,
                max_def: max_def ? parseInt(max_def) : undefined,
                attribute: attribute,
                race: race,
            };
            const result = await userCardModel_1.UserCardModel.getUserCollection(req.user.id, filters);
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get specific card details from user's collection
     */
    static async getCardDetail(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const cardId = parseInt(req.params.cardId);
            if (isNaN(cardId)) {
                throw new errorHandler_1.ValidationError('Invalid card ID');
            }
            const userCard = await userCardModel_1.UserCardModel.getUserCard(req.user.id, cardId);
            if (!userCard) {
                throw new errorHandler_1.NotFoundError('Card not found in collection');
            }
            res.json({ card: userCard });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Remove card from collection
     */
    static async removeCard(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const userCardId = parseInt(req.params.id);
            if (isNaN(userCardId)) {
                throw new errorHandler_1.ValidationError('Invalid user card ID');
            }
            const removed = await userCardModel_1.UserCardModel.removeFromCollection(req.user.id, userCardId);
            if (!removed) {
                throw new errorHandler_1.NotFoundError('Card not found in collection');
            }
            logger_1.loggers.collection.cardRemoved(req.user.id, userCardId);
            res.json({ message: 'Card removed from collection' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update card quantity in collection
     */
    static async updateQuantity(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const userCardId = parseInt(req.params.id);
            const { quantity } = req.body;
            if (isNaN(userCardId)) {
                throw new errorHandler_1.ValidationError('Invalid user card ID');
            }
            if (quantity === undefined || quantity < 0 || quantity > 100) {
                throw new errorHandler_1.ValidationError('quantity must be between 0 and 100');
            }
            const updatedCard = await userCardModel_1.UserCardModel.updateQuantity(req.user.id, userCardId, quantity);
            if (quantity === 0 || !updatedCard) {
                logger_1.loggers.collection.cardRemoved(req.user.id, userCardId);
                res.json({ message: 'Card removed from collection' });
            }
            else {
                res.json({
                    message: 'Card quantity updated',
                    card: updatedCard,
                });
            }
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CollectionController = CollectionController;
