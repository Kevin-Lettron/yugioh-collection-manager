"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const deckController_1 = require("../controllers/deckController");
const router = (0, express_1.Router)();
// Public routes (with optional auth for user-specific data)
router.get('/public', authMiddleware_1.optionalAuth, deckController_1.DeckController.getPublicDecks);
router.get('/shared/:shareToken', deckController_1.DeckController.getSharedDeck); // Guest access - no auth required
router.get('/:id', authMiddleware_1.optionalAuth, deckController_1.DeckController.getDeckById);
router.get('/:id/validate', authMiddleware_1.optionalAuth, deckController_1.DeckController.validateDeck);
// Protected routes
router.get('/', authMiddleware_1.authenticateToken, deckController_1.DeckController.getUserDecks);
router.post('/', authMiddleware_1.authenticateToken, deckController_1.DeckController.createDeck);
router.put('/:id', authMiddleware_1.authenticateToken, deckController_1.DeckController.updateDeck);
router.delete('/:id', authMiddleware_1.authenticateToken, deckController_1.DeckController.deleteDeck);
router.post('/:id/cards', authMiddleware_1.authenticateToken, deckController_1.DeckController.addCardToDeck);
router.delete('/:id/cards', authMiddleware_1.authenticateToken, deckController_1.DeckController.clearDeckCards);
router.delete('/:id/cards/:cardId', authMiddleware_1.authenticateToken, deckController_1.DeckController.removeCardFromDeck);
router.put('/:id/cards/:cardId', authMiddleware_1.authenticateToken, deckController_1.DeckController.updateCardQuantity);
// Share routes
router.post('/:id/share', authMiddleware_1.authenticateToken, deckController_1.DeckController.generateShareLink);
router.delete('/:id/share', authMiddleware_1.authenticateToken, deckController_1.DeckController.removeShareLink);
exports.default = router;
