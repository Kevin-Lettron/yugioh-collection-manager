import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { CommentController } from '../controllers/commentController';

const router = Router();

// Public routes (viewing comments)
router.get('/deck/:deckId', optionalAuth, CommentController.getComments);
router.get('/:commentId/replies', optionalAuth, CommentController.getReplies);

// Protected routes (creating/editing comments)
router.post('/deck/:deckId', authenticateToken, CommentController.createComment);
router.post('/:commentId/reply', authenticateToken, CommentController.createReply);
router.put('/:commentId', authenticateToken, CommentController.updateComment);
router.delete('/:commentId', authenticateToken, CommentController.deleteComment);

export default router;
