import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports
const transports: winston.transport[] = [
  // Console output
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),

  // Error logs - separate file
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  }),

  // Combined logs - all levels
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
  }),

  // Debug logs - separate file (only in development)
  ...(process.env.NODE_ENV !== 'production'
    ? [
        new DailyRotateFile({
          filename: path.join(logsDir, 'debug-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          level: 'debug',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '7d',
          zippedArchive: true,
        }),
      ]
    : []),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan middleware
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

// Helper methods for structured logging
export const loggers = {
  // Database operations
  db: {
    query: (query: string, params?: any[]) => {
      logger.debug('Database query', { query, params });
    },
    error: (error: Error, query?: string) => {
      logger.error('Database error', { error: error.message, stack: error.stack, query });
    },
    connection: (status: 'connected' | 'disconnected' | 'error', details?: any) => {
      if (status === 'error') {
        logger.error('Database connection error', details);
      } else {
        logger.info(`Database ${status}`, details);
      }
    },
  },

  // API requests
  api: {
    request: (method: string, url: string, userId?: number) => {
      logger.info('API request', { method, url, userId });
    },
    response: (method: string, url: string, statusCode: number, duration: number) => {
      logger.info('API response', { method, url, statusCode, duration });
    },
    error: (error: Error, method: string, url: string, userId?: number) => {
      logger.error('API error', {
        error: error.message,
        stack: error.stack,
        method,
        url,
        userId,
      });
    },
  },

  // Authentication
  auth: {
    login: (userId: number, email: string, success: boolean) => {
      if (success) {
        logger.info('User login successful', { userId, email });
      } else {
        logger.warn('User login failed', { email });
      }
    },
    register: (userId: number, email: string, username: string) => {
      logger.info('User registered', { userId, email, username });
    },
    logout: (userId: number) => {
      logger.info('User logout', { userId });
    },
    tokenError: (error: string) => {
      logger.warn('JWT token error', { error });
    },
  },

  // WebSocket
  socket: {
    connection: (socketId: string, userId?: number) => {
      logger.info('WebSocket connection', { socketId, userId });
    },
    disconnect: (socketId: string, userId?: number) => {
      logger.info('WebSocket disconnect', { socketId, userId });
    },
    emit: (event: string, data: any) => {
      logger.debug('WebSocket emit', { event, data });
    },
    error: (error: Error, socketId: string) => {
      logger.error('WebSocket error', {
        error: error.message,
        stack: error.stack,
        socketId,
      });
    },
  },

  // File operations
  file: {
    upload: (userId: number, filename: string, size: number) => {
      logger.info('File uploaded', { userId, filename, size });
    },
    delete: (filename: string) => {
      logger.info('File deleted', { filename });
    },
    error: (error: Error, operation: string) => {
      logger.error('File operation error', {
        error: error.message,
        stack: error.stack,
        operation,
      });
    },
  },

  // External API calls
  external: {
    request: (api: string, endpoint: string, params?: any) => {
      logger.debug('External API request', { api, endpoint, params });
    },
    response: (api: string, endpoint: string, statusCode: number, duration: number) => {
      logger.debug('External API response', { api, endpoint, statusCode, duration });
    },
    error: (api: string, error: Error, endpoint?: string) => {
      logger.error('External API error', {
        api,
        error: error.message,
        stack: error.stack,
        endpoint,
      });
    },
  },

  // Business logic
  deck: {
    created: (deckId: number, userId: number, name: string) => {
      logger.info('Deck created', { deckId, userId, name });
    },
    updated: (deckId: number, userId: number) => {
      logger.info('Deck updated', { deckId, userId });
    },
    deleted: (deckId: number, userId: number) => {
      logger.info('Deck deleted', { deckId, userId });
    },
    validationError: (deckId: number, errors: string[]) => {
      logger.warn('Deck validation failed', { deckId, errors });
    },
  },

  collection: {
    cardAdded: (userId: number, cardId: number, quantity: number) => {
      logger.info('Card added to collection', { userId, cardId, quantity });
    },
    cardRemoved: (userId: number, cardId: number) => {
      logger.info('Card removed from collection', { userId, cardId });
    },
  },

  social: {
    follow: (followerId: number, followingId: number) => {
      logger.info('User followed', { followerId, followingId });
    },
    unfollow: (followerId: number, followingId: number) => {
      logger.info('User unfollowed', { followerId, followingId });
    },
    comment: (userId: number, deckId: number, commentId: number) => {
      logger.info('Comment created', { userId, deckId, commentId });
    },
    reaction: (userId: number, deckId: number, isLike: boolean) => {
      logger.info('Deck reaction', { userId, deckId, type: isLike ? 'like' : 'dislike' });
    },
  },
};

export default logger;
