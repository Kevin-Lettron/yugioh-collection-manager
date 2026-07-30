import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import logger, { loggers } from './utils/logger';
import { validateStartupEnv } from './utils/env';

// Load environment variables
dotenv.config();

// Fail-fast if required env vars are missing or use insecure defaults
try {
  validateStartupEnv();
} catch (err) {
  console.error('❌', (err as Error).message);
  process.exit(1);
}

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:', process.env.CLIENT_URL || 'http://localhost:5173'],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global rate limit as a safety net against runaway clients / obvious abuse
import { globalLimiter } from './middleware/rateLimit';
app.use('/api', globalLimiter);

// Serve static files (uploads) with CORS headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(process.cwd(), 'uploads')));

// Socket.io auth middleware — verify JWT from handshake before allowing connection
import { verifyToken } from './utils/jwt';

io.use((socket, next) => {
  const token =
    (socket.handshake.auth?.token as string | undefined) ||
    (socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string | undefined);

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = verifyToken(token);
    (socket.data as { userId?: number }).userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket.data as { userId?: number }).userId;
  if (!userId) {
    socket.disconnect(true);
    return;
  }

  // Join only the room for the authenticated userId — client cannot spoof another user's room
  socket.join(`user:${userId}`);
  loggers.socket.connection(socket.id, userId);

  // Legacy 'authenticate' event kept for backwards compat but the room is already joined
  // and userId comes from the verified JWT — client-sent userId is ignored.
  socket.on('authenticate', () => {
    loggers.socket.connection(socket.id, userId);
  });

  socket.on('disconnect', () => {
    loggers.socket.disconnect(socket.id, userId);
  });
});

// Make io available in routes
app.set('io', io);

// Health check — reachable both at /health (server-local) and /api/health (via nginx public)
const healthHandler = (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
import authRoutes from './routes/authRoutes';
import collectionRoutes from './routes/collectionRoutes';
import deckRoutes from './routes/deckRoutes';
import socialRoutes from './routes/socialRoutes';
import reactionRoutes from './routes/reactionRoutes';
import commentRoutes from './routes/commentRoutes';
import notificationRoutes from './routes/notificationRoutes';
import debugRoutes from './routes/debugRoutes';
import adminRoutes from './routes/adminRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Debug routes (dev only — writes arbitrary client events to server logs)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
  logger.info('Debug routes enabled (dev mode)');
}

// Error handler (must be last)
app.use(errorHandler);

// Start server
httpServer.listen(PORT, () => {
  logger.info(`
╔══════════════════════════════════════════════════╗
║   🎴 YuGiOh Collection Manager API Server       ║
║   🚀 Server running on http://localhost:${PORT}   ║
║   📡 WebSocket ready                             ║
║   🗄️  Database: PostgreSQL                       ║
╚══════════════════════════════════════════════════╝
  `);
  logger.info('Server started successfully');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
export { io };
