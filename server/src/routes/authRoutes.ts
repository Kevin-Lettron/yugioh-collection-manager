import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { uploadProfilePicture } from '../middleware/uploadMiddleware';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/users/search', optionalAuth, AuthController.searchUsers);
router.get('/users/:id', AuthController.getUserById);

// Protected routes
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.post('/profile/avatar', authenticateToken, uploadProfilePicture, AuthController.uploadAvatar);

export default router;
