import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { NotificationModel } from '../models/notificationModel';

export class NotificationController {
  /**
   * Get user's notifications with pagination
   */
  static async getNotifications(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { page = 1, limit = 50, unread_only = 'false' } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      const unreadOnly = unread_only === 'true';

      const result = await NotificationModel.getUserNotifications(
        req.user.id,
        limitNum,
        offset,
        unreadOnly
      );

      res.json({
        notifications: result.notifications,
        total: result.total,
        unread_count: result.unread_count,
        page: pageNum,
        limit: limitNum,
        total_pages: Math.ceil(result.total / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const notificationId = parseInt(req.params.notificationId);

      if (isNaN(notificationId)) {
        throw new ValidationError('Invalid notification ID');
      }

      const marked = await NotificationModel.markAsRead(notificationId, req.user.id);

      if (!marked) {
        throw new NotFoundError('Notification not found or already read');
      }

      res.json({ message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const count = await NotificationModel.markAllAsRead(req.user.id);

      res.json({
        message: `${count} notification${count !== 1 ? 's' : ''} marked as read`,
        count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const notificationId = parseInt(req.params.notificationId);

      if (isNaN(notificationId)) {
        throw new ValidationError('Invalid notification ID');
      }

      const deleted = await NotificationModel.delete(notificationId, req.user.id);

      if (!deleted) {
        throw new NotFoundError('Notification not found');
      }

      res.json({ message: 'Notification deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const count = await NotificationModel.getUnreadCount(req.user.id);

      res.json({ unread_count: count });
    } catch (error) {
      next(error);
    }
  }
}
