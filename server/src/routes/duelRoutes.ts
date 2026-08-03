import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { DuelController } from '../controllers/duelController';
import { DuelEngineController } from '../controllers/duelEngineController';

const router = Router();

// Le moteur avant `/:id` : `/engine/stats` serait sinon capté par la route
// paramétrée, qui tenterait de lire « engine » comme un identifiant.
router.get('/engine/stats', authenticateToken, DuelEngineController.stats);

router.post('/',           authenticateToken, DuelController.challenge);
router.get('/',            authenticateToken, DuelController.listMyDuels);
router.get('/:id',         authenticateToken, DuelController.getDuel);
router.post('/:id/accept', authenticateToken, DuelController.accept);
router.post('/:id/reject', authenticateToken, DuelController.reject);
router.post('/:id/cancel', authenticateToken, DuelController.cancel);
router.post('/:id/action', authenticateToken, DuelController.performAction);

// ─── Mode moteur (ygopro-core) — cf. docs/PLAN-MOTEUR-DUEL.md
router.post('/:id/engine/start',   authenticateToken, DuelEngineController.start);
router.post('/:id/engine/respond', authenticateToken, DuelEngineController.respond);
router.delete('/:id/engine',       authenticateToken, DuelEngineController.close);

export default router;
