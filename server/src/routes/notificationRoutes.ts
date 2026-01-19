import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { NotificationController } from '../controllers/notificationController';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

// Notification routes
router.get('/', NotificationController.getNotifications);
router.put('/:id/read', NotificationController.markAsRead);
router.put('/read-all', NotificationController.markAllAsRead);
router.delete('/:id', NotificationController.deleteNotification);

export default router;
