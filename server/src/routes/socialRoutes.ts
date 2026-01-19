import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { SocialController } from '../controllers/socialController';

const router = Router();

// All social routes require authentication
router.use(authenticateToken);

// Follow routes
router.post('/follow/:userId', SocialController.followUser);
router.delete('/follow/:userId', SocialController.unfollowUser);
router.get('/followers', SocialController.getFollowers);
router.get('/followers/:userId', SocialController.getUserFollowers);
router.get('/following', SocialController.getFollowing);
router.get('/following/:userId', SocialController.getUserFollowing);

// Wishlist routes
router.post('/wishlist/:deckId', SocialController.addToWishlist);
router.delete('/wishlist/:deckId', SocialController.removeFromWishlist);
router.get('/wishlist', SocialController.getWishlist);

export default router;
