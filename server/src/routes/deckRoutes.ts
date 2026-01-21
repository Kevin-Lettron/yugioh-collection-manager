import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { DeckController } from '../controllers/deckController';

const router = Router();

// Public routes (with optional auth for user-specific data)
router.get('/public', optionalAuth, DeckController.getPublicDecks);
router.get('/shared/:shareToken', DeckController.getSharedDeck); // Guest access - no auth required
router.get('/:id', optionalAuth, DeckController.getDeckById);
router.get('/:id/validate', optionalAuth, DeckController.validateDeck);

// Protected routes
router.get('/', authenticateToken, DeckController.getUserDecks);
router.post('/', authenticateToken, DeckController.createDeck);
router.put('/:id', authenticateToken, DeckController.updateDeck);
router.delete('/:id', authenticateToken, DeckController.deleteDeck);
router.post('/:id/cards', authenticateToken, DeckController.addCardToDeck);
router.delete('/:id/cards', authenticateToken, DeckController.clearDeckCards);
router.delete('/:id/cards/:cardId', authenticateToken, DeckController.removeCardFromDeck);
router.put('/:id/cards/:cardId', authenticateToken, DeckController.updateCardQuantity);

// Share routes
router.post('/:id/share', authenticateToken, DeckController.generateShareLink);
router.delete('/:id/share', authenticateToken, DeckController.removeShareLink);

// AI routes
router.get('/ai/status', authenticateToken, DeckController.getAIStatus);
router.post('/ai/build', authenticateToken, DeckController.buildWithAI);
router.post('/ai/reset', authenticateToken, DeckController.resetAICounter);

export default router;
