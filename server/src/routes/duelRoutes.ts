import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { DuelController } from '../controllers/duelController';

const router = Router();

router.post('/',           authenticateToken, DuelController.challenge);
router.get('/',            authenticateToken, DuelController.listMyDuels);
router.get('/:id',         authenticateToken, DuelController.getDuel);
router.post('/:id/accept', authenticateToken, DuelController.accept);
router.post('/:id/reject', authenticateToken, DuelController.reject);
router.post('/:id/cancel', authenticateToken, DuelController.cancel);
router.post('/:id/action', authenticateToken, DuelController.performAction);

export default router;
