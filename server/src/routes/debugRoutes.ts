import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

const router = Router();

// Defensive rate limit — even in dev, a runaway client shouldn't be able to flood logs
const debugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 2 events/sec average per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Debug log rate limit exceeded' },
});

router.use(authenticateToken);
router.use(debugLimiter);

router.post('/log', (req: AuthRequest, res) => {
  const rawEvent = typeof req.body?.event === 'string' ? req.body.event : 'unknown';
  // Sanitize event name — allow only alphanumerics, colon, dot, dash, underscore
  // Prevents log injection (CRLF, ANSI escapes, etc.) via crafted event names
  const event = rawEvent.replace(/[^a-zA-Z0-9:._-]/g, '_').slice(0, 100);

  // Cap data payload to avoid disk fills via oversize logs
  const rawData = req.body?.data;
  const data =
    rawData && typeof rawData === 'object'
      ? JSON.parse(JSON.stringify(rawData).slice(0, 4000))
      : {};

  logger.info(`[CLIENT_DEBUG] ${event}`, {
    ...data,
    clientTimestamp: req.body?.timestamp,
    userId: req.user?.id,
  });
  res.status(204).send();
});

export default router;
