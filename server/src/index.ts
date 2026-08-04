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

  // Duel rooms — un joueur peut rejoindre la room d'un duel dont il est
  // participant. La verification "participe au duel ?" est faite cote HTTP
  // (GET /duels/:id) qui 403 si l'user n'y est pas. Rejoindre la room ici
  // ne donne acces qu'aux broadcasts d'actions (le state complet arrive
  // dans le payload — on considere que les 2 joueurs ont le droit de tout voir).
  socket.on('duel:join', (payload: { duelId?: number }) => {
    const duelId = Number(payload?.duelId);
    if (!Number.isInteger(duelId) || duelId <= 0) return;
    socket.join(`duel:${duelId}`);
  });

  socket.on('duel:leave', (payload: { duelId?: number }) => {
    const duelId = Number(payload?.duelId);
    if (!Number.isInteger(duelId) || duelId <= 0) return;
    socket.leave(`duel:${duelId}`);
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
import clientErrorRoutes from './routes/clientErrorRoutes';
import adminRoutes from './routes/adminRoutes';
import duelRoutes from './routes/duelRoutes';
import newsRoutes from './routes/newsRoutes';
import { onWorkerLost, shutdownEngine } from './services/duelEngine/engineClient';
import { loadHintStrings } from './services/duelEngine/hintStrings';
import { rehydrateActiveDuels } from './services/duelEngine/rehydrate';

// Charge les textes d'EDOPro (strings.conf) une fois pour toutes. Fichier
// optionnel : en son absence, les invites tombent sur des libellés génériques.
loadHintStrings();

app.use('/api/auth', authRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/decks', deckRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/reactions', reactionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/duels', duelRoutes);
app.use('/api/news', newsRoutes);

// Crashs clients — monté aussi en production : un crash n'a de valeur que s'il
// remonte depuis les appareils réels. Auth optionnelle, débit plafonné.
app.use('/api/client-errors', clientErrorRoutes);

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

  // ─── F6 · Reprise après redémarrage ───────────────────────────
  // Rejoue automatiquement les duels `active` — le moteur perd son tas au
  // reboot, mais le journal + la graine suffisent à reconstruire chaque partie.
  // Décalé pour laisser le worker s'initialiser (le moteur met ~1 s à charger).
  setTimeout(() => {
    rehydrateActiveDuels()
      .then((bilan) => {
        if (bilan.total > 0) {
          logger.info(
            `[duel:rehydrate] ${bilan.ok}/${bilan.total} duels actifs rejoués (${bilan.ko} échec(s))`
          );
        }
      })
      .catch((err) =>
        logger.error(`[duel:rehydrate] KO — ${err instanceof Error ? err.message : err}`)
      );
  }, 3_000);

  // ─── Cron actualités ────────────────────────────────────────
  // Ingestion : une fois au démarrage puis toutes les 30 minutes.
  // Purge : une fois par jour pour dégonfler les 6+ mois.
  // Un `Promise` orphelin (pas d'`await`) : on ne veut pas bloquer le boot.
  import('./services/news/ingest').then(({ ingestAllSources, purgeOldItems }) => {
    const runIngest = () => {
      ingestAllSources()
        .then((bilan) => {
          const total = Object.values(bilan).reduce(
            (acc, r) => ({
              inserted: acc.inserted + r.inserted,
              skipped: acc.skipped + r.skipped,
              errors: acc.errors + r.errors,
            }),
            { inserted: 0, skipped: 0, errors: 0 }
          );
          logger.info('[news:cron] ingest', total);
        })
        .catch((err) => logger.error('[news:cron] ingest KO', { error: err instanceof Error ? err.message : err }));
    };

    const runPurge = () => {
      purgeOldItems()
        .then((n) => { if (n > 0) logger.info(`[news:cron] purge ${n} article(s)`); })
        .catch((err) => logger.error('[news:cron] purge KO', { error: err instanceof Error ? err.message : err }));
    };

    // Premier tir au démarrage (une petite temporisation pour laisser la DB
    // finir de s'éveiller et le pool de se remplir).
    setTimeout(runIngest, 5_000);

    // Rythme de croisière — chaque source décide finement de son intervalle
    // via `min_interval_minutes` en base ; ce timer est le battement d'horloge.
    setInterval(runIngest, 30 * 60 * 1000);

    // Ménage quotidien.
    setInterval(runPurge, 24 * 60 * 60 * 1000);
  }).catch((err) => {
    logger.error('[news:cron] chargement KO', { error: err instanceof Error ? err.message : err });
  });
});

// Moteur de duel — un worker qui meurt emporte les parties qu'il hébergeait.
// ygopro-core n'expose aucune sérialisation d'un duel en cours : on ne peut pas
// les reprendre, seulement prévenir les joueurs. Politique retenue : le duel est
// annulé, sans défaite pour personne (cf. docs/PLAN-MOTEUR-DUEL.md, étape 4).
// Vaut aussi pour les duels purgés faute d'activité : dans les deux cas le
// moteur ne connaît plus la partie.
onWorkerLost((lostDuelIds, reason) => {
  for (const duelId of lostDuelIds) {
    io.to(`duel:${duelId}`).emit('duel:engine_lost', { duelId, reason });
  }

  // Sans ça, ces duels resteraient « actifs » en base indéfiniment : la liste
  // des duels en cours se remplirait de parties que plus rien ne fait avancer.
  import('./models/duelEngineModel')
    .then(({ DuelEngineModel }) => DuelEngineModel.cancelLostDuels(lostDuelIds))
    .then((n) => {
      if (n > 0) logger.info(`[DUEL_ENGINE] ${n} duel(s) annulé(s) en base (${reason})`);
    })
    .catch((err) =>
      logger.error(`[DUEL_ENGINE] annulation en base impossible : ${err}`)
    );
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  shutdownEngine()
    .catch(() => undefined)
    .finally(() => {
      httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
});

export default app;
export { io };
