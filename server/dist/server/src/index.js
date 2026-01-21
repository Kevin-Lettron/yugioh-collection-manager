"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = __importStar(require("./utils/logger"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Create HTTP server
const httpServer = (0, http_1.createServer)(app);
// Initialize Socket.io
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});
exports.io = io;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files (uploads)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../../uploads')));
// Socket.io connection handling
io.on('connection', (socket) => {
    logger_1.loggers.socket.connection(socket.id);
    // Authenticate and join user's room
    socket.on('authenticate', (userId) => {
        socket.join(`user:${userId}`);
        logger_1.loggers.socket.connection(socket.id, userId);
    });
    socket.on('disconnect', () => {
        logger_1.loggers.socket.disconnect(socket.id);
    });
});
// Make io available in routes
app.set('io', io);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const collectionRoutes_1 = __importDefault(require("./routes/collectionRoutes"));
const deckRoutes_1 = __importDefault(require("./routes/deckRoutes"));
const socialRoutes_1 = __importDefault(require("./routes/socialRoutes"));
const reactionRoutes_1 = __importDefault(require("./routes/reactionRoutes"));
const commentRoutes_1 = __importDefault(require("./routes/commentRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
app.use('/api/auth', authRoutes_1.default);
app.use('/api/collection', collectionRoutes_1.default);
app.use('/api/decks', deckRoutes_1.default);
app.use('/api/social', socialRoutes_1.default);
app.use('/api/reactions', reactionRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
// Error handler (must be last)
app.use(errorHandler_1.errorHandler);
// Start server
httpServer.listen(PORT, () => {
    logger_1.default.info(`
╔══════════════════════════════════════════════════╗
║   🎴 YuGiOh Collection Manager API Server       ║
║   🚀 Server running on http://localhost:${PORT}   ║
║   📡 WebSocket ready                             ║
║   🗄️  Database: PostgreSQL                       ║
╚══════════════════════════════════════════════════╝
  `);
    logger_1.default.info('Server started successfully');
});
// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
exports.default = app;
