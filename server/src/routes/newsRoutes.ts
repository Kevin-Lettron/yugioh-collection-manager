import { Router } from 'express';
import {
  authenticateToken,
  optionalAuth,
  requireAdmin,
} from '../middleware/authMiddleware';
import { NewsController } from '../controllers/newsController';

const router = Router();

// Lecture du fil et découverte des thèmes : auth optionnelle, la page doit
// s'afficher pour un visiteur non connecté.
router.get('/', optionalAuth, NewsController.list);
router.get('/topics', optionalAuth, NewsController.listTopics);
router.get('/releases', optionalAuth, NewsController.releases);

// Modifier ses abonnements suppose un compte.
router.put('/topics', authenticateToken, NewsController.updateTopics);

// Déclenchement manuel de l'ingestion — réservé aux admins/modérateurs.
router.post('/refresh', authenticateToken, requireAdmin, NewsController.refresh);

export default router;
