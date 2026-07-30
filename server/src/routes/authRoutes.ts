import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { uploadProfilePicture, verifyDiskUploadMagicBytes } from '../middleware/uploadMiddleware';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

// Public routes (rate-limited — brute-force protection)
router.post('/register', authLimiter, AuthController.register);
router.post('/login', authLimiter, AuthController.login);
router.get('/users/search', optionalAuth, AuthController.searchUsers);
router.get('/users/:id', AuthController.getUserById);

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post(
  '/profile/avatar',
  authenticateToken,
  uploadProfilePicture,
  verifyDiskUploadMagicBytes,
  AuthController.uploadAvatar
);

export default router;
