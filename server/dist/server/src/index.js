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
const env_1 = require("./utils/env");
// Load environment variables
dotenv_1.default.config();
// Fail-fast if required env vars are missing or use insecure defaults
try {
    (0, env_1.validateStartupEnv)();
}
catch (err) {
    console.error('❌', err.message);
    process.exit(1);
}
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
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'blob:', process.env.CLIENT_URL || 'http://localhost:5173'],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '100kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '100kb' }));
// Global rate limit as a safety net against runaway clients / obvious abuse
const rateLimit_1 = require("./middleware/rateLimit");
app.use('/api', rateLimit_1.globalLimiter);
// Serve static files (uploads) with CORS headers
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
// Socket.io auth middleware — verify JWT from handshake before allowing connection
const jwt_1 = require("./utils/jwt");
io.use((socket, next) => {
    const token = socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const decoded = (0, jwt_1.verifyToken)(token);
        socket.data.userId = decoded.id;
        next();
    }
    catch {
        next(new Error('Invalid or expired token'));
    }
});
io.on('connection', (socket) => {
    const userId = socket.data.userId;
    if (!userId) {
        socket.disconnect(true);
        return;
    }
    // Join only the room for the authenticated userId — client cannot spoof another user's room
    socket.join(`user:${userId}`);
    logger_1.loggers.socket.connection(socket.id, userId);
    // Legacy 'authenticate' event kept for backwards compat but the room is already joined
    // and userId comes from the verified JWT — client-sent userId is ignored.
    socket.on('authenticate', () => {
        logger_1.loggers.socket.connection(socket.id, userId);
    });
    // Duel rooms — un joueur peut rejoindre la room d'un duel dont il est
    // participant. La verification "participe au duel ?" est faite cote HTTP
    // (GET /duels/:id) qui 403 si l'user n'y est pas. Rejoindre la room ici
    // ne donne acces qu'aux broadcasts d'actions (le state complet arrive
    // dans le payload — on considere que les 2 joueurs ont le droit de tout voir).
    socket.on('duel:join', (payload) => {
        const duelId = Number(payload?.duelId);
        if (!Number.isInteger(duelId) || duelId <= 0)
            return;
        socket.join(`duel:${duelId}`);
    });
    socket.on('duel:leave', (payload) => {
        const duelId = Number(payload?.duelId);
        if (!Number.isInteger(duelId) || duelId <= 0)
            return;
        socket.leave(`duel:${duelId}`);
    });
    socket.on('disconnect', () => {
        logger_1.loggers.socket.disconnect(socket.id, userId);
    });
});
// Make io available in routes
app.set('io', io);
// Health check — reachable both at /health (server-local) and /api/health (via nginx public)
const healthHandler = (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
// API Routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const collectionRoutes_1 = __importDefault(require("./routes/collectionRoutes"));
const deckRoutes_1 = __importDefault(require("./routes/deckRoutes"));
const socialRoutes_1 = __importDefault(require("./routes/socialRoutes"));
const reactionRoutes_1 = __importDefault(require("./routes/reactionRoutes"));
const commentRoutes_1 = __importDefault(require("./routes/commentRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const debugRoutes_1 = __importDefault(require("./routes/debugRoutes"));
const clientErrorRoutes_1 = __importDefault(require("./routes/clientErrorRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const duelRoutes_1 = __importDefault(require("./routes/duelRoutes"));
const engineClient_1 = require("./services/duelEngine/engineClient");
app.use('/api/auth', authRoutes_1.default);
app.use('/api/collection', collectionRoutes_1.default);
app.use('/api/decks', deckRoutes_1.default);
app.use('/api/social', socialRoutes_1.default);
app.use('/api/reactions', reactionRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use('/api/duels', duelRoutes_1.default);
// Crashs clients — monté aussi en production : un crash n'a de valeur que s'il
// remonte depuis les appareils réels. Auth optionnelle, débit plafonné.
app.use('/api/client-errors', clientErrorRoutes_1.default);
// Debug routes (dev only — writes arbitrary client events to server logs)
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/debug', debugRoutes_1.default);
    logger_1.default.info('Debug routes enabled (dev mode)');
}
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
// Moteur de duel — un worker qui meurt emporte les parties qu'il hébergeait.
// ygopro-core n'expose aucune sérialisation d'un duel en cours : on ne peut pas
// les reprendre, seulement prévenir les joueurs. Politique retenue : le duel est
// annulé, sans défaite pour personne (cf. docs/PLAN-MOTEUR-DUEL.md, étape 4).
(0, engineClient_1.onWorkerLost)((lostDuelIds, reason) => {
    for (const duelId of lostDuelIds) {
        io.to(`duel:${duelId}`).emit('duel:engine_lost', { duelId, reason });
    }
});
// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    (0, engineClient_1.shutdownEngine)()
        .catch(() => undefined)
        .finally(() => {
        httpServer.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});
exports.default = app;
