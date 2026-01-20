import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Notification } from '../../../shared/types';
import { useAuth } from './AuthContext';
import socketService from '../services/socket';
import api from '../services/api';
import toast from 'react-hot-toast';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: Notification) => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const markAsRead = async (notificationId: number) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
    }
  };

  // Setup socket connection when user logs in
  useEffect(() => {
    if (user) {
      // Connect socket
      socketService.connect(user.id);

      // Listen for new notifications
      socketService.onNotification((notification: Notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Show toast notification
        toast.success(getNotificationMessage(notification), {
          duration: 4000,
        });
      });

      // Fetch initial notifications
      fetchNotifications();
    }

    return () => {
      if (user) {
        socketService.offNotification();
        socketService.disconnect();
      }
    };
  }, [user, fetchNotifications]);

  const getNotificationMessage = (notification: Notification): string => {
    const username = notification.from_user?.username || 'Someone';
    switch (notification.type) {
      case 'follow':
        return `${username} started following you`;
      case 'like':
        return `${username} liked your deck`;
      case 'dislike':
        return `${username} disliked your deck`;
      case 'comment':
        return `${username} commented on your deck`;
      case 'reply':
        return `${username} replied to your comment`;
      default:
        return 'New notification';
    }
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
