import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, AuthRequest } from '../middleware/authMiddleware';
import logger from '../utils/logger';

/**
 * Remontée des crashs clients (mobile et web) dans les logs serveur.
 *
 * Volontairement distinct de `/api/debug`, pour deux raisons :
 *   - `/api/debug` n'est monté qu'en développement, alors qu'un crash n'a de
 *     valeur que s'il remonte depuis la production ;
 *   - `/api/debug` exige un token, alors qu'un crash survient souvent avant
 *     la connexion (écran de login) ou justement parce que la session est
 *     cassée. L'authentification est donc optionnelle : elle enrichit le log
 *     quand elle est présente, mais ne conditionne pas l'enregistrement.
 *
 * Contrepartie d'un endpoint ouvert : c'est un vecteur d'inondation de logs.
 * D'où un plafond serré et des payloads tronqués.
 */
const router = Router();

const crashLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Crash report rate limit exceeded' },
});

/** Tronque et neutralise les retours chariot (injection de fausses lignes de log). */
function clean(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.replace(/[\r\n]+/g, ' ⏎ ').slice(0, maxLength);
}

router.post('/', crashLimiter, optionalAuth, (req: AuthRequest, res) => {
  const message = clean(req.body?.message, 500) || 'Erreur client sans message';
  const stack = clean(req.body?.stack, 4000);
  const screen = clean(req.body?.screen, 120);
  const platform = clean(req.body?.platform, 40);
  const appVersion = clean(req.body?.appVersion, 40);
  const source = clean(req.body?.source, 40) || 'unknown';
  const isFatal = req.body?.isFatal === true;

  // Le contexte libre est sérialisé puis tronqué : un client compromis ne doit
  // pas pouvoir remplir le disque avec un seul envoi.
  let context: unknown;
  if (req.body?.context && typeof req.body.context === 'object') {
    try {
      context = JSON.parse(JSON.stringify(req.body.context).slice(0, 2000));
    } catch {
      context = undefined;
    }
  }

  logger.error(`[CLIENT_CRASH] ${message}`, {
    source,
    platform,
    appVersion,
    screen,
    isFatal,
    stack,
    context,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: clean(req.get('user-agent'), 200),
  });

  // 204 : le client n'a rien à faire de la réponse, et surtout il ne doit pas
  // réessayer — une boucle de report sur erreur de report serait catastrophique.
  res.status(204).send();
});

export default router;
