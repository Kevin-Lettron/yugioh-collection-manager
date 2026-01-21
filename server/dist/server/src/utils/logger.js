"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggers = exports.stream = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure logs directory exists
const logsDir = path_1.default.join(__dirname, '../../logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// Define log format
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json());
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
}));
// Create transports
const transports = [
    // Console output
    new winston_1.default.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
    // Error logs - separate file
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }),
    // Combined logs - all levels
    new winston_daily_rotate_file_1.default({
        filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        format: logFormat,
        maxSize: '20m',
        maxFiles: '14d',
        zippedArchive: true,
    }),
    // Debug logs - separate file (only in development)
    ...(process.env.NODE_ENV !== 'production'
        ? [
            new winston_daily_rotate_file_1.default({
                filename: path_1.default.join(logsDir, 'debug-%DATE%.log'),
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
const logger = winston_1.default.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports,
    exitOnError: false,
});
// Create a stream object for Morgan middleware
exports.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};
// Helper methods for structured logging
exports.loggers = {
    // Database operations
    db: {
        query: (query, params) => {
            logger.debug('Database query', { query, params });
        },
        error: (error, query) => {
            logger.error('Database error', { error: error.message, stack: error.stack, query });
        },
        connection: (status, details) => {
            if (status === 'error') {
                logger.error('Database connection error', details);
            }
            else {
                logger.info(`Database ${status}`, details);
            }
        },
    },
    // API requests
    api: {
        request: (method, url, userId) => {
            logger.info('API request', { method, url, userId });
        },
        response: (method, url, statusCode, duration) => {
            logger.info('API response', { method, url, statusCode, duration });
        },
        error: (error, method, url, userId) => {
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
        login: (userId, email, success) => {
            if (success) {
                logger.info('User login successful', { userId, email });
            }
            else {
                logger.warn('User login failed', { email });
            }
        },
        register: (userId, email, username) => {
            logger.info('User registered', { userId, email, username });
        },
        logout: (userId) => {
            logger.info('User logout', { userId });
        },
        tokenError: (error) => {
            logger.warn('JWT token error', { error });
        },
    },
    // WebSocket
    socket: {
        connection: (socketId, userId) => {
            logger.info('WebSocket connection', { socketId, userId });
        },
        disconnect: (socketId, userId) => {
            logger.info('WebSocket disconnect', { socketId, userId });
        },
        emit: (event, data) => {
            logger.debug('WebSocket emit', { event, data });
        },
        error: (error, socketId) => {
            logger.error('WebSocket error', {
                error: error.message,
                stack: error.stack,
                socketId,
            });
        },
    },
    // File operations
    file: {
        upload: (userId, filename, size) => {
            logger.info('File uploaded', { userId, filename, size });
        },
        delete: (filename) => {
            logger.info('File deleted', { filename });
        },
        error: (error, operation) => {
            logger.error('File operation error', {
                error: error.message,
                stack: error.stack,
                operation,
            });
        },
    },
    // External API calls
    external: {
        request: (api, endpoint, params) => {
            logger.debug('External API request', { api, endpoint, params });
        },
        response: (api, endpoint, statusCode, duration) => {
            logger.debug('External API response', { api, endpoint, statusCode, duration });
        },
        error: (api, error, endpoint) => {
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
        created: (deckId, userId, name) => {
            logger.info('Deck created', { deckId, userId, name });
        },
        updated: (deckId, userId) => {
            logger.info('Deck updated', { deckId, userId });
        },
        deleted: (deckId, userId) => {
            logger.info('Deck deleted', { deckId, userId });
        },
        validationError: (deckId, errors) => {
            logger.warn('Deck validation failed', { deckId, errors });
        },
    },
    collection: {
        cardAdded: (userId, cardId, quantity) => {
            logger.info('Card added to collection', { userId, cardId, quantity });
        },
        cardRemoved: (userId, cardId) => {
            logger.info('Card removed from collection', { userId, cardId });
        },
    },
    social: {
        follow: (followerId, followingId) => {
            logger.info('User followed', { followerId, followingId });
        },
        unfollow: (followerId, followingId) => {
            logger.info('User unfollowed', { followerId, followingId });
        },
        comment: (userId, deckId, commentId) => {
            logger.info('Comment created', { userId, deckId, commentId });
        },
        reaction: (userId, deckId, isLike) => {
            logger.info('Deck reaction', { userId, deckId, type: isLike ? 'like' : 'dislike' });
        },
    },
};
exports.default = logger;
