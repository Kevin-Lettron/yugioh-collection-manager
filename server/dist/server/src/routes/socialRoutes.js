"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const socialController_1 = require("../controllers/socialController");
const router = (0, express_1.Router)();
// All social routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Follow routes
router.post('/follow/:userId', socialController_1.SocialController.followUser);
router.delete('/follow/:userId', socialController_1.SocialController.unfollowUser);
router.get('/followers', socialController_1.SocialController.getFollowers);
router.get('/followers/:userId', socialController_1.SocialController.getFollowers);
router.get('/following', socialController_1.SocialController.getFollowing);
router.get('/following/:userId', socialController_1.SocialController.getFollowing);
// Wishlist routes
router.post('/wishlist/:deckId', socialController_1.SocialController.addToWishlist);
router.delete('/wishlist/:deckId', socialController_1.SocialController.removeFromWishlist);
router.get('/wishlist', socialController_1.SocialController.getWishlist);
exports.default = router;
