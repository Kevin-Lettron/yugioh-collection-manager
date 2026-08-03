"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const userCardModel_1 = require("../models/userCardModel");
const cardModel_1 = require("../models/cardModel");
const ygoprodeckService_1 = require("../services/ygoprodeckService");
const cardScanService_1 = require("../services/cardScanService");
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
            const { page = 1, limit = 50, search, type, frame_type, rarity, level, min_atk, max_atk, min_def, max_def, attribute, race, card_id, } = req.query;
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
                card_id: card_id ? parseInt(card_id) : undefined,
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
     * Scan a card photo with Claude Vision to detect its set code.
     * Photo is processed in memory only, never stored on disk.
     */
    static async scanCard(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            if (!req.file) {
                throw new errorHandler_1.ValidationError('Photo manquante (champ "photo" requis)');
            }
            const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowed.includes(req.file.mimetype)) {
                throw new errorHandler_1.ValidationError('Format non supporté (JPEG, PNG, WebP ou GIF uniquement)');
            }
            const rawMediaType = (req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype);
            // Preprocess (sharp) : autoOrient + resize 1600 + normalize + sharpen.
            // Le code de set fait quelques pixels de haut — sans ça Claude confond
            // souvent les caractères similaires (0/O, 1/I) sur photo iPhone floue.
            const { preprocessCardImage } = await Promise.resolve().then(() => __importStar(require('../utils/imagePreprocess')));
            const { buffer: processedBuf, mediaType } = await preprocessCardImage(req.file.buffer, rawMediaType);
            const base64 = processedBuf.toString('base64');
            const description = typeof req.body?.description === 'string' ? req.body.description : undefined;
            // 'code' = gros plan sur le seul code de set, 'card' (défaut) = carte entière
            const mode = (0, cardScanService_1.parseScanMode)(req.body?.mode);
            logger_1.loggers.external.request('Claude Vision', '/scan', {
                sizeIn: req.file.size,
                sizeOut: processedBuf.length,
                mode,
                hasDescription: !!description,
            });
            const result = await (0, cardScanService_1.scanCard)(base64, mediaType, description, mode);
            res.json({
                ...result,
                remainingScans: (0, cardScanService_1.getRemainingScanCalls)(),
            });
        }
        catch (error) {
            // On NE remonte PAS via next(error) : cela fait passer l'erreur par
            // errorHandler qui masque le message reel en prod ("Une erreur interne
            // est survenue"). On renvoie 200 avec success:false + le vrai message
            // pour que le client puisse l'afficher a l'user.
            const err = error;
            logger_1.loggers.external.error('Claude Vision', err, '/scan');
            res.json({
                success: false,
                error: `Scan echoue : ${err.name || 'Error'} — ${err.message || 'erreur inconnue'}`,
                remainingScans: (0, cardScanService_1.getRemainingScanCalls)(),
            });
        }
    }
    /**
     * Diagnose scan setup : test API key + model with a minimal Claude call.
     * Used to debug the "erreur interne" without needing SSH access.
     */
    static async diagnoseScan(_req, res, next) {
        try {
            const { diagnose } = await Promise.resolve().then(() => __importStar(require('../services/cardScanService')));
            const result = await diagnose();
            res.json(result);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Agrégats de la collection (total cartes, ultra/secret rares, valeur EUR, répartition).
     * Endpoint séparé de /cards car il calcule sur TOUTES les cartes, hors pagination.
     */
    static async getCollectionStats(req, res, next) {
        try {
            if (!req.user)
                throw new errorHandler_1.ValidationError('Not authenticated');
            const stats = await userCardModel_1.UserCardModel.getCollectionStats(req.user.id);
            res.json(stats);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Disponibilité par carte : combien possédé, combien utilisé dans les
     * autres decks, combien reste pour ajouter au deck en cours.
     * `?exclude_deck=<id>` retire ce deck du calcul "used_in_decks".
     */
    static async getAvailability(req, res, next) {
        try {
            if (!req.user)
                throw new errorHandler_1.ValidationError('Not authenticated');
            const rawExclude = req.query.exclude_deck;
            const excludeDeckId = typeof rawExclude === 'string' && /^\d+$/.test(rawExclude) ? parseInt(rawExclude, 10) : undefined;
            const availability = await userCardModel_1.UserCardModel.getAvailability(req.user.id, excludeDeckId);
            res.json(availability);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Return the current scan quota for the user.
     */
    static async getScanStatus(_req, res, next) {
        try {
            res.json({
                remaining: (0, cardScanService_1.getRemainingScanCalls)(),
                max: (0, cardScanService_1.getMaxScanCalls)(),
                used: (0, cardScanService_1.getScanCallCount)(),
            });
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
