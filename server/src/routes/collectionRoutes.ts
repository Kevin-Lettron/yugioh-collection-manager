import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { CollectionController } from '../controllers/collectionController';

const router = Router();

// All collection routes require authentication
router.use(authenticateToken);

// Collection routes
router.post('/cards/add', CollectionController.addCardByCode);
router.get('/cards', CollectionController.getUserCollection);
router.get('/cards/:id', CollectionController.getCardDetail);
router.delete('/cards/:id', CollectionController.removeCard);
router.put('/cards/:id/quantity', CollectionController.updateQuantity);

export default router;
