"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public routes
router.post('/register', authController_1.AuthController.register);
router.post('/login', authController_1.AuthController.login);
router.get('/users/search', authMiddleware_1.optionalAuth, authController_1.AuthController.searchUsers);
router.get('/users/:id', authController_1.AuthController.getUserById);
// Protected routes
router.get('/profile', authMiddleware_1.authenticateToken, authController_1.AuthController.getProfile);
router.put('/profile', authMiddleware_1.authenticateToken, authController_1.AuthController.updateProfile);
exports.default = router;
