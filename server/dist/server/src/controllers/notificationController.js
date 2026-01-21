"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const notificationModel_1 = require("../models/notificationModel");
class NotificationController {
    /**
     * Get user's notifications with pagination
     */
    static async getNotifications(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const { page = 1, limit = 50, unread_only = 'false' } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const offset = (pageNum - 1) * limitNum;
            const unreadOnly = unread_only === 'true';
            const result = await notificationModel_1.NotificationModel.getUserNotifications(req.user.id, limitNum, offset, unreadOnly);
            res.json({
                notifications: result.notifications,
                total: result.total,
                unread_count: result.unread_count,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(result.total / limitNum),
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark a notification as read
     */
    static async markAsRead(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const notificationId = parseInt(req.params.id);
            if (isNaN(notificationId)) {
                throw new errorHandler_1.ValidationError('Invalid notification ID');
            }
            const marked = await notificationModel_1.NotificationModel.markAsRead(notificationId, req.user.id);
            if (!marked) {
                throw new errorHandler_1.NotFoundError('Notification not found or already read');
            }
            res.json({ message: 'Notification marked as read' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Mark all notifications as read
     */
    static async markAllAsRead(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const count = await notificationModel_1.NotificationModel.markAllAsRead(req.user.id);
            res.json({
                message: `${count} notification${count !== 1 ? 's' : ''} marked as read`,
                count,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Delete a notification
     */
    static async deleteNotification(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const notificationId = parseInt(req.params.id);
            if (isNaN(notificationId)) {
                throw new errorHandler_1.ValidationError('Invalid notification ID');
            }
            const deleted = await notificationModel_1.NotificationModel.delete(notificationId, req.user.id);
            if (!deleted) {
                throw new errorHandler_1.NotFoundError('Notification not found');
            }
            res.json({ message: 'Notification deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get unread notification count
     */
    static async getUnreadCount(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.ValidationError('Not authenticated');
            }
            const count = await notificationModel_1.NotificationModel.getUnreadCount(req.user.id);
            res.json({ unread_count: count });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.NotificationController = NotificationController;
