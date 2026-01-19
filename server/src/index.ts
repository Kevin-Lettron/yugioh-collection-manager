import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import logger, { loggers } from './utils/logger';

// Load environment variables
dotenv.config();

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
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Socket.io connection handling
io.on('connection', (socket) => {
  loggers.socket.connection(socket.id);

  // Authenticate and join user's room
  socket.on('authenticate', (userId: number) => {
    socket.join(`user:${userId}`);
    loggers.socket.connection(socket.id, userId);
  });

  socket.on('disconnect', () => {
    loggers.socket.disconnect(socket.id);
  });
});

// Make io available in routes
app.set('io', io);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
import authRoutes from './routes/authRoutes';
import collectionRoutes from './routes/collectionRoutes';
import deckRoutes from './routes/deckRoutes';
import socialRoutes from './routes/socialRoutes';
import reactionRoutes from './routes/reactionRoutes';
import commentRoutes from './routes/commentRoutes';
import notificationRoutes from './routes/notificationRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

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
