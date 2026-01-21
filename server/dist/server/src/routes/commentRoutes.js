"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const commentController_1 = require("../controllers/commentController");
const router = (0, express_1.Router)();
// Public routes (viewing comments)
router.get('/deck/:deckId', authMiddleware_1.optionalAuth, commentController_1.CommentController.getComments);
router.get('/:commentId/replies', authMiddleware_1.optionalAuth, commentController_1.CommentController.getReplies);
// Protected routes (creating/editing comments)
router.post('/deck/:deckId', authMiddleware_1.authenticateToken, commentController_1.CommentController.createComment);
router.post('/:commentId/reply', authMiddleware_1.authenticateToken, commentController_1.CommentController.createComment);
router.put('/:commentId', authMiddleware_1.authenticateToken, commentController_1.CommentController.updateComment);
router.delete('/:commentId', authMiddleware_1.authenticateToken, commentController_1.CommentController.deleteComment);
exports.default = router;
