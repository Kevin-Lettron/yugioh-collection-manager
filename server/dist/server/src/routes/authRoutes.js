"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const uploadMiddleware_1 = require("../middleware/uploadMiddleware");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
// Public routes (rate-limited — brute-force protection)
router.post('/register', rateLimit_1.authLimiter, authController_1.AuthController.register);
router.post('/login', rateLimit_1.authLimiter, authController_1.AuthController.login);
router.get('/users/search', authMiddleware_1.optionalAuth, authController_1.AuthController.searchUsers);
router.get('/users/:id', authController_1.AuthController.getUserById);
// Protected routes
router.get('/profile', authMiddleware_1.authenticateToken, authController_1.AuthController.getProfile);
router.put('/profile', authMiddleware_1.authenticateToken, authController_1.AuthController.updateProfile);
router.post('/profile/avatar', authMiddleware_1.authenticateToken, uploadMiddleware_1.uploadProfilePicture, uploadMiddleware_1.verifyDiskUploadMagicBytes, authController_1.AuthController.uploadAvatar);
exports.default = router;
