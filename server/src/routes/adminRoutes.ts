import { Router } from 'express';
import { authenticateToken, requireAdmin, requireStrictAdmin } from '../middleware/authMiddleware';
import { AdminController } from '../controllers/adminController';

const router = Router();

// All admin routes require auth + admin/moderator role
router.use(authenticateToken);
router.use(requireAdmin);

// ── Dashboard
router.get('/stats', AdminController.getStats);

// ── Users
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.getUserDetail);
// Role changes, disable and user deletion = strict admin only (no moderators)
router.patch('/users/:id/role', requireStrictAdmin, AdminController.updateUserRole);
router.patch('/users/:id/status', requireStrictAdmin, AdminController.toggleUserActive);
router.delete('/users/:id', requireStrictAdmin, AdminController.deleteUser);

// ── Decks
router.get('/decks', AdminController.listDecks);
router.delete('/decks/:id', AdminController.deleteDeck);
router.post('/decks/:id/unshare', AdminController.forceUnshareDeck);

// ── Comments
router.get('/comments', AdminController.listComments);
router.delete('/comments/:id', AdminController.deleteComment);

// ── Application logs (page /admin/logs)
router.get('/logs', AdminController.listLogs);

export default router;
