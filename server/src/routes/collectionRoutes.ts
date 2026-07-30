import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { uploadCardScan, verifyMemoryUploadMagicBytes } from '../middleware/uploadMiddleware';
import { scanLimiter } from '../middleware/rateLimit';
import { CollectionController } from '../controllers/collectionController';

const router = Router();

// All collection routes require authentication
router.use(authenticateToken);

// Search route - search card by code (Card ID or Set Code)
router.get('/search', CollectionController.searchCard);

// Card scanning (Claude Vision) — rate-limited per user to cap Anthropic spend
router.post(
  '/scan',
  scanLimiter,
  uploadCardScan,
  verifyMemoryUploadMagicBytes,
  CollectionController.scanCard
);
router.get('/scan/status', CollectionController.getScanStatus);

// Collection routes
router.post('/cards/add', CollectionController.addCardByCode);
router.get('/cards', CollectionController.getUserCollection);
router.get('/cards/:id', CollectionController.getCardDetail);
router.delete('/cards/:id', CollectionController.removeCard);
router.put('/cards/:id/quantity', CollectionController.updateQuantity);

export default router;
