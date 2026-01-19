import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { DeckController } from '../controllers/deckController';

const router = Router();

// Public routes (with optional auth for user-specific data)
router.get('/public', optionalAuth, DeckController.getPublicDecks);
router.get('/:id', optionalAuth, DeckController.getDeckById);
router.get('/:id/validate', optionalAuth, DeckController.validateDeck);

// Protected routes
router.get('/', authenticateToken, DeckController.getUserDecks);
router.post('/', authenticateToken, DeckController.createDeck);
router.put('/:id', authenticateToken, DeckController.updateDeck);
router.delete('/:id', authenticateToken, DeckController.deleteDeck);
router.post('/:id/cards', authenticateToken, DeckController.addCardToDeck);
router.delete('/:id/cards/:cardId', authenticateToken, DeckController.removeCardFromDeck);
router.put('/:id/cards/:cardId', authenticateToken, DeckController.updateCardQuantity);

export default router;
