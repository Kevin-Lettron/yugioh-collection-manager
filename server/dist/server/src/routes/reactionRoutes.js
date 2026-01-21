"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const reactionController_1 = require("../controllers/reactionController");
const router = (0, express_1.Router)();
// All reaction routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Reaction routes
router.post('/decks/:deckId/like', reactionController_1.ReactionController.likeDeck);
router.post('/decks/:deckId/dislike', reactionController_1.ReactionController.dislikeDeck);
router.delete('/decks/:deckId', reactionController_1.ReactionController.removeReaction);
router.get('/decks/:deckId', reactionController_1.ReactionController.getReactionCounts);
exports.default = router;
