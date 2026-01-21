"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const notificationController_1 = require("../controllers/notificationController");
const router = (0, express_1.Router)();
// All notification routes require authentication
router.use(authMiddleware_1.authenticateToken);
// Notification routes
router.get('/', notificationController_1.NotificationController.getNotifications);
router.put('/:id/read', notificationController_1.NotificationController.markAsRead);
router.put('/read-all', notificationController_1.NotificationController.markAllAsRead);
router.delete('/:id', notificationController_1.NotificationController.deleteNotification);
exports.default = router;
