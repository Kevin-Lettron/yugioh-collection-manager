import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import { AuthProvider } from '../../context/AuthContext';
import api from '../../services/api';
import socketService from '../../services/socket';

// Mock the modules
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('../../services/socket', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onNotification: jest.fn(),
    offNotification: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useAuth to provide user state
jest.mock('../../context/AuthContext', () => ({
  ...jest.requireActual('../../context/AuthContext'),
  useAuth: jest.fn(),
}));

import { useAuth } from '../../context/AuthContext';

const mockedApi = api as jest.Mocked<typeof api>;
const mockedSocket = socketService as jest.Mocked<typeof socketService>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Test component that uses the notification context
const TestComponent = () => {
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead } =
    useNotifications();

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="unread-count">{unreadCount}</div>
      <div data-testid="notifications">{JSON.stringify(notifications)}</div>
      <button onClick={fetchNotifications} data-testid="fetch-btn">
        Fetch
      </button>
      <button onClick={() => markAsRead(1)} data-testid="mark-read-btn">
        Mark Read
      </button>
      <button onClick={markAllAsRead} data-testid="mark-all-read-btn">
        Mark All Read
      </button>
    </div>
  );
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
};

describe('NotificationContext', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockNotifications = [
    {
      id: 1,
      user_id: 1,
      type: 'follow' as const,
      from_user_id: 2,
      is_read: false,
      created_at: new Date(),
      from_user: { username: 'follower1' },
    },
    {
      id: 2,
      user_id: 1,
      type: 'like' as const,
      from_user_id: 3,
      deck_id: 1,
      is_read: true,
      created_at: new Date(),
      from_user: { username: 'liker1' },
    },
    {
      id: 3,
      user_id: 1,
      type: 'comment' as const,
      from_user_id: 4,
      deck_id: 1,
      is_read: false,
      created_at: new Date(),
      from_user: { username: 'commenter1' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      updateUser: jest.fn(),
    });
    mockedApi.get.mockResolvedValue({ data: [] });
  });

  describe('Initial State', () => {
    it('has empty notifications initially', async () => {
      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('notifications')).toHaveTextContent('[]');
      });
    });

    it('has zero unread count initially', async () => {
      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });
    });

    it('shows loading as false initially', () => {
      renderWithProviders(<TestComponent />);
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });

  describe('Socket Connection', () => {
    it('connects socket when user is present', async () => {
      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedSocket.connect).toHaveBeenCalledWith(mockUser.id);
      });
    });

    it('sets up notification listener', async () => {
      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedSocket.onNotification).toHaveBeenCalled();
      });
    });

    it('does not connect socket when user is null', async () => {
      mockedUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        register: jest.fn(),
        logout: jest.fn(),
        updateUser: jest.fn(),
      });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedSocket.connect).not.toHaveBeenCalled();
      });
    });

    it('disconnects socket on unmount', async () => {
      const { unmount } = renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedSocket.connect).toHaveBeenCalled();
      });

      unmount();

      expect(mockedSocket.offNotification).toHaveBeenCalled();
      expect(mockedSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Fetch Notifications', () => {
    it('fetches notifications from API', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedApi.get).toHaveBeenCalledWith('/notifications');
      });
    });

    it('updates notifications state', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        const notificationsDiv = screen.getByTestId('notifications');
        expect(notificationsDiv.textContent).toContain('follower1');
      });
    });

    it('calculates unread count correctly', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        // 2 unread notifications (id 1 and 3)
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });
    });

    it('sets loading state during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedApi.get.mockReturnValue(pendingPromise as any);

      renderWithProviders(<TestComponent />);

      await userEvent.click(screen.getByTestId('fetch-btn'));

      // Loading should be true while fetching
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('true');
      });

      // Resolve the promise
      act(() => {
        resolvePromise!({ data: [] });
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
    });

    it('handles fetch error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      // Should not crash and should maintain empty state
      expect(screen.getByTestId('notifications')).toHaveTextContent('[]');
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Mark as Read', () => {
    it('calls API to mark notification as read', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-read-btn'));

      await waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith('/notifications/1/read');
      });
    });

    it('updates notification state to read', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-read-btn'));

      await waitFor(() => {
        // Unread count should decrease
        expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      });
    });

    it('decrements unread count', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-read-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      });
    });

    it('handles mark as read error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockRejectedValue(new Error('Failed to mark as read'));

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-read-btn'));

      // Should not crash, count should remain unchanged
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Mark All as Read', () => {
    it('calls API to mark all notifications as read', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-all-read-btn'));

      await waitFor(() => {
        expect(mockedApi.put).toHaveBeenCalledWith('/notifications/read-all');
      });
    });

    it('marks all notifications as read in state', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-all-read-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });
    });

    it('handles mark all as read error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockedApi.get.mockResolvedValue({ data: mockNotifications });
      mockedApi.put.mockRejectedValue(new Error('Failed to mark all as read'));

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('2');
      });

      await userEvent.click(screen.getByTestId('mark-all-read-btn'));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Real-time Notifications', () => {
    it('adds new notification when received via socket', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      let socketCallback: ((notification: any) => void) | undefined;
      mockedSocket.onNotification.mockImplementation((callback) => {
        socketCallback = callback;
      });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(mockedSocket.onNotification).toHaveBeenCalled();
      });

      const newNotification = {
        id: 4,
        user_id: 1,
        type: 'follow' as const,
        from_user_id: 5,
        is_read: false,
        created_at: new Date(),
        from_user: { username: 'newfollower' },
      };

      // Simulate receiving a notification via socket
      act(() => {
        socketCallback?.(newNotification);
      });

      await waitFor(() => {
        const notificationsDiv = screen.getByTestId('notifications');
        expect(notificationsDiv.textContent).toContain('newfollower');
      });
    });

    it('increments unread count when new notification received', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      let socketCallback: ((notification: any) => void) | undefined;
      mockedSocket.onNotification.mockImplementation((callback) => {
        socketCallback = callback;
      });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });

      const newNotification = {
        id: 4,
        user_id: 1,
        type: 'follow' as const,
        from_user_id: 5,
        is_read: false,
        created_at: new Date(),
        from_user: { username: 'newfollower' },
      };

      act(() => {
        socketCallback?.(newNotification);
      });

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      });
    });

    it('prepends new notification to list', async () => {
      mockedApi.get.mockResolvedValue({ data: mockNotifications });

      let socketCallback: ((notification: any) => void) | undefined;
      mockedSocket.onNotification.mockImplementation((callback) => {
        socketCallback = callback;
      });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('notifications')).not.toHaveTextContent('[]');
      });

      const newNotification = {
        id: 100,
        user_id: 1,
        type: 'follow' as const,
        from_user_id: 5,
        is_read: false,
        created_at: new Date(),
        from_user: { username: 'newfollower' },
      };

      act(() => {
        socketCallback?.(newNotification);
      });

      await waitFor(() => {
        const notifications = JSON.parse(screen.getByTestId('notifications').textContent || '[]');
        // New notification should be first
        expect(notifications[0].id).toBe(100);
      });
    });
  });

  describe('useNotifications Hook', () => {
    it('throws error when used outside NotificationProvider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const TestOutsideProvider = () => {
        try {
          useNotifications();
          return <div>No error</div>;
        } catch (error) {
          return <div>Error thrown</div>;
        }
      };

      render(<TestOutsideProvider />);
      expect(screen.getByText('Error thrown')).toBeInTheDocument();

      consoleError.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty notification list', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('notifications')).toHaveTextContent('[]');
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });
    });

    it('handles all notifications already read', async () => {
      const allReadNotifications = mockNotifications.map((n) => ({ ...n, is_read: true }));
      mockedApi.get.mockResolvedValue({ data: allReadNotifications });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });
    });

    it('unread count does not go below zero', async () => {
      mockedApi.get.mockResolvedValue({ data: [] });
      mockedApi.put.mockResolvedValue({ data: {} });

      renderWithProviders(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });

      // Try to mark as read when already at 0
      await userEvent.click(screen.getByTestId('mark-read-btn'));

      await waitFor(() => {
        // Should still be 0, not negative
        expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
      });
    });
  });
});
