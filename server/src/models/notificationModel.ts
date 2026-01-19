import { query } from '../config/database';
import { Notification } from '../../../shared/types';

export class NotificationModel {
  /**
   * Create a notification
   */
  static async create(
    userId: number,
    type: 'follow' | 'like' | 'dislike' | 'comment' | 'reply',
    fromUserId?: number,
    deckId?: number,
    commentId?: number
  ): Promise<Notification> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, from_user_id, deck_id, comment_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, type, fromUserId || null, deckId || null, commentId || null]
    );

    return this.parseNotification(result.rows[0]);
  }

  /**
   * Get user's notifications
   */
  static async getUserNotifications(
    userId: number,
    limit: number = 50,
    offset: number = 0,
    unreadOnly: boolean = false
  ): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
    // Get total count
    const countCondition = unreadOnly ? 'AND is_read = false' : '';
    const countResult = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 ${countCondition}`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get unread count
    const unreadResult = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    const unread_count = parseInt(unreadResult.rows[0].count);

    // Get notifications with user and deck details
    const readCondition = unreadOnly ? 'AND n.is_read = false' : '';
    const result = await query(
      `SELECT n.*,
              u.id as from_user_id, u.username as from_username, u.profile_picture as from_profile_picture,
              d.id as deck_id, d.name as deck_name, d.cover_image as deck_cover_image
       FROM notifications n
       LEFT JOIN users u ON n.from_user_id = u.id
       LEFT JOIN decks d ON n.deck_id = d.id
       WHERE n.user_id = $1 ${readCondition}
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const notifications = result.rows.map((row) => this.parseNotification(row));

    return { notifications, total, unread_count };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId: number): Promise<number> {
    const result = await query(
      `UPDATE notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false
       RETURNING id`,
      [userId]
    );

    return result.rows.length;
  }

  /**
   * Delete notification
   */
  static async delete(notificationId: number, userId: number): Promise<boolean> {
    const result = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Delete all notifications for a user
   */
  static async deleteAll(userId: number): Promise<number> {
    const result = await query(
      `DELETE FROM notifications WHERE user_id = $1 RETURNING id`,
      [userId]
    );

    return result.rows.length;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Check if notification already exists (to prevent duplicates)
   */
  static async exists(
    userId: number,
    type: string,
    fromUserId?: number,
    deckId?: number,
    commentId?: number
  ): Promise<boolean> {
    const result = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = $2
       AND ($3::int IS NULL OR from_user_id = $3)
       AND ($4::int IS NULL OR deck_id = $4)
       AND ($5::int IS NULL OR comment_id = $5)
       AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId, type, fromUserId || null, deckId || null, commentId || null]
    );

    return result.rows.length > 0;
  }

  /**
   * Parse notification from database row
   */
  private static parseNotification(row: any): Notification {
    const notification: Notification = {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      from_user_id: row.from_user_id,
      deck_id: row.deck_id,
      comment_id: row.comment_id,
      is_read: row.is_read,
      created_at: row.created_at,
    };

    // Add from_user if present
    if (row.from_user_id && row.from_username) {
      notification.from_user = {
        id: row.from_user_id,
        username: row.from_username,
        profile_picture: row.from_profile_picture,
      };
    }

    // Add deck if present
    if (row.deck_id && row.deck_name) {
      notification.deck = {
        id: row.deck_id,
        name: row.deck_name,
        cover_image: row.deck_cover_image,
      };
    }

    return notification;
  }
}
