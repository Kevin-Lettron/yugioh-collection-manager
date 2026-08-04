import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { DuelController } from '../controllers/duelController';
import { DuelEngineController } from '../controllers/duelEngineController';
import { DuelMatchController } from '../controllers/duelMatchController';

const router = Router();

// Le moteur avant `/:id` : `/engine/stats` serait sinon capté par la route
// paramétrée, qui tenterait de lire « engine » comme un identifiant.
router.get('/engine/stats', authenticateToken, DuelEngineController.stats);

// ─── Matches Bo1/Bo2/Bo3 (F4 du PLAN-DUEL-AMELIORATIONS) — avant `/:id` pour
// éviter que `matches` soit lu comme un id.
router.post('/matches',                          authenticateToken, DuelMatchController.create);
router.get('/matches/:id',                       authenticateToken, DuelMatchController.view);
router.post('/matches/:matchId/side-deck/submit', authenticateToken, DuelMatchController.submitSideDeck);
router.post('/matches/:matchId/next-game',       authenticateToken, DuelMatchController.nextGame);

router.post('/',           authenticateToken, DuelController.challenge);
router.get('/',            authenticateToken, DuelController.listMyDuels);
router.get('/:id',         authenticateToken, DuelController.getDuel);
router.post('/:id/accept', authenticateToken, DuelController.accept);
router.post('/:id/reject', authenticateToken, DuelController.reject);
router.post('/:id/cancel', authenticateToken, DuelController.cancel);
router.post('/:id/action', authenticateToken, DuelController.performAction);

// ─── Pile ou face (avant lancement du moteur) — cf. §4 F1 de PLAN-DUEL-AMELIORATIONS
router.post('/:id/coin-flip',            authenticateToken, DuelEngineController.coinFlip);
router.post('/:id/first-player-choice',  authenticateToken, DuelEngineController.firstPlayerChoice);

// ─── Mode moteur (ygopro-core) — cf. docs/PLAN-MOTEUR-DUEL.md
router.post('/:id/engine/start',      authenticateToken, DuelEngineController.start);
router.get('/:id/engine/pre-game',    authenticateToken, DuelEngineController.preGame);
router.get('/:id/engine',             authenticateToken, DuelEngineController.view);
router.post('/:id/engine/choose',     authenticateToken, DuelEngineController.choose);
router.post('/:id/engine/surrender',  authenticateToken, DuelEngineController.surrender);
router.delete('/:id/engine',          authenticateToken, DuelEngineController.close);
router.post('/:id/engine/announce-card/search',
                                      authenticateToken, DuelEngineController.announceSearch);
// ─── F7 · vue spectateur (lecture seule)
router.get('/:id/engine/spectate',    authenticateToken, DuelEngineController.spectate);
// ─── F6 · reprise manuelle (admin)
router.post('/:id/engine/rehydrate',  authenticateToken, DuelEngineController.rehydrate);

export default router;
