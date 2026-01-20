import { io, Socket } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  return {
    io: jest.fn(() => mockSocket),
  };
});

const mockedIo = io as jest.MockedFunction<typeof io>;

describe('Socket Service', () => {
  let mockSocket: {
    connected: boolean;
    on: jest.Mock;
    off: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    mockSocket = {
      connected: false,
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };

    mockedIo.mockReturnValue(mockSocket as unknown as Socket);
  });

  describe('connect', () => {
    it('creates a new socket connection', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockedIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          autoConnect: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        })
      );
    });

    it('returns the socket instance', async () => {
      const socketService = (await import('../../services/socket')).default;

      const result = socketService.connect(1);

      expect(result).toBe(mockSocket);
    });

    it('sets up connect event listener', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('sets up disconnect event listener', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('sets up connect_error event listener', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('emits authenticate event on connect', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(123);

      // Get the connect callback and call it
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      const connectCallback = connectCall?.[1];
      connectCallback?.();

      expect(mockSocket.emit).toHaveBeenCalledWith('authenticate', 123);
    });

    it('returns existing socket if already connected', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      mockSocket.connected = true;

      // Second connect should return existing socket
      const result = socketService.connect(1);

      expect(result).toBe(mockSocket);
      // io should only be called once
      expect(mockedIo).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect', () => {
    it('disconnects the socket', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      socketService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('sets socket to null after disconnect', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      socketService.disconnect();

      expect(socketService.getSocket()).toBeNull();
    });

    it('handles disconnect when not connected', async () => {
      const socketService = (await import('../../services/socket')).default;

      // Should not throw
      expect(() => socketService.disconnect()).not.toThrow();
    });
  });

  describe('getSocket', () => {
    it('returns null when not connected', async () => {
      const socketService = (await import('../../services/socket')).default;

      expect(socketService.getSocket()).toBeNull();
    });

    it('returns socket when connected', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(socketService.getSocket()).toBe(mockSocket);
    });
  });

  describe('onNotification', () => {
    it('registers notification listener', async () => {
      const socketService = (await import('../../services/socket')).default;
      const callback = jest.fn();

      socketService.connect(1);
      socketService.onNotification(callback);

      expect(mockSocket.on).toHaveBeenCalledWith('notification', callback);
    });

    it('does not throw when socket is null', async () => {
      const socketService = (await import('../../services/socket')).default;
      const callback = jest.fn();

      expect(() => socketService.onNotification(callback)).not.toThrow();
    });

    it('receives notifications via callback', async () => {
      const socketService = (await import('../../services/socket')).default;
      const callback = jest.fn();

      socketService.connect(1);
      socketService.onNotification(callback);

      // Get the notification callback
      const notificationCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'notification'
      );
      const notificationCallback = notificationCall?.[1];

      // Simulate receiving a notification
      const mockNotification = { id: 1, type: 'follow', message: 'New follower' };
      notificationCallback?.(mockNotification);

      expect(callback).toHaveBeenCalledWith(mockNotification);
    });
  });

  describe('offNotification', () => {
    it('removes notification listener', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      socketService.offNotification();

      expect(mockSocket.off).toHaveBeenCalledWith('notification');
    });

    it('does not throw when socket is null', async () => {
      const socketService = (await import('../../services/socket')).default;

      expect(() => socketService.offNotification()).not.toThrow();
    });
  });

  describe('Reconnection', () => {
    it('configures reconnection options', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockedIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        })
      );
    });

    it('logs connection errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      // Get the connect_error callback
      const errorCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect_error'
      );
      const errorCallback = errorCall?.[1];

      // Simulate connection error
      const error = new Error('Connection failed');
      errorCallback?.(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket connection error:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('logs connection success', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      // Trigger connect callback
      const connectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'connect'
      );
      connectCall?.[1]?.();

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('logs disconnection', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      // Trigger disconnect callback
      const disconnectCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      );
      disconnectCall?.[1]?.();

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });
  });

  describe('Multiple Connections', () => {
    it('maintains single socket instance', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      const firstSocket = socketService.getSocket();

      // Simulate connected state
      mockSocket.connected = true;

      socketService.connect(2);
      const secondSocket = socketService.getSocket();

      expect(firstSocket).toBe(secondSocket);
    });

    it('creates new socket after disconnect', async () => {
      jest.resetModules();

      const newMockSocket = {
        connected: false,
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      let callCount = 0;
      mockedIo.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return mockSocket as unknown as Socket;
        }
        return newMockSocket as unknown as Socket;
      });

      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      socketService.disconnect();

      socketService.connect(2);

      expect(mockedIo).toHaveBeenCalledTimes(2);
    });
  });

  describe('Event Types', () => {
    it('handles different notification types', async () => {
      const socketService = (await import('../../services/socket')).default;
      const callback = jest.fn();

      socketService.connect(1);
      socketService.onNotification(callback);

      const notificationCall = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'notification'
      );
      const notificationCallback = notificationCall?.[1];

      // Test follow notification
      notificationCallback?.({
        id: 1,
        type: 'follow',
        from_user: { username: 'user1' },
      });

      // Test like notification
      notificationCallback?.({
        id: 2,
        type: 'like',
        from_user: { username: 'user2' },
        deck_id: 1,
      });

      // Test comment notification
      notificationCallback?.({
        id: 3,
        type: 'comment',
        from_user: { username: 'user3' },
        deck_id: 1,
        comment_id: 1,
      });

      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('handles null callback in onNotification', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      // Should not throw with null callback
      expect(() => socketService.onNotification(null as any)).not.toThrow();
    });

    it('handles multiple disconnect calls', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);
      socketService.disconnect();
      socketService.disconnect();
      socketService.disconnect();

      // Should only call disconnect once
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });

    it('handles onNotification before connect', async () => {
      const socketService = (await import('../../services/socket')).default;
      const callback = jest.fn();

      // Should not throw
      expect(() => socketService.onNotification(callback)).not.toThrow();
    });

    it('handles offNotification before connect', async () => {
      const socketService = (await import('../../services/socket')).default;

      // Should not throw
      expect(() => socketService.offNotification()).not.toThrow();
    });
  });

  describe('Socket URL Configuration', () => {
    it('uses environment variable for socket URL', async () => {
      const socketService = (await import('../../services/socket')).default;

      socketService.connect(1);

      expect(mockedIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
