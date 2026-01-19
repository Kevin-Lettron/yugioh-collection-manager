import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { ReactionController } from '../controllers/reactionController';

const router = Router();

// All reaction routes require authentication
router.use(authenticateToken);

// Reaction routes
router.post('/decks/:deckId/like', ReactionController.likeDeck);
router.post('/decks/:deckId/dislike', ReactionController.dislikeDeck);
router.delete('/decks/:deckId', ReactionController.removeReaction);
router.get('/decks/:deckId', ReactionController.getReactionCounts);

export default router;
