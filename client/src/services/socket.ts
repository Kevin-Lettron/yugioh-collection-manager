import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

class SocketService {
  private socket: Socket | null = null;

  connect(_userId: number): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = localStorage.getItem('token') || '';

    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // JWT is verified server-side before connection is accepted.
      // Server derives userId from the token — client-sent userId is ignored.
      auth: { token },
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Notification listeners
  onNotification(callback: (notification: any) => void): void {
    this.socket?.on('notification', callback);
  }

  offNotification(): void {
    this.socket?.off('notification');
  }
}

export default new SocketService();
