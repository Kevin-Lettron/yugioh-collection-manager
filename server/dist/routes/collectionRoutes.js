"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const collectionController_1 = require("../controllers/collectionController");
const router = (0, express_1.Router)();
// All collection routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Search route - search card by code (Card ID or Set Code)
router.get('/search', collectionController_1.CollectionController.searchCard);
// Collection routes
router.post('/cards/add', collectionController_1.CollectionController.addCardByCode);
router.get('/cards', collectionController_1.CollectionController.getUserCollection);
router.get('/cards/:id', collectionController_1.CollectionController.getCardDetail);
router.delete('/cards/:id', collectionController_1.CollectionController.removeCard);
router.put('/cards/:id/quantity', collectionController_1.CollectionController.updateQuantity);
exports.default = router;
