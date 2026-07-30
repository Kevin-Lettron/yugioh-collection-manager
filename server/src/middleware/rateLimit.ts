import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthRequest } from './authMiddleware';

/**
 * Key rate limits by authenticated userId when available, else by IP.
 * Prevents a single user from consuming quota that would otherwise be per-IP-shared
 * (behind NATs or corporate networks).
 */
const keyByUserOrIp = (req: Request): string => {
  const userId = (req as AuthRequest).user?.id;
  return userId ? `user:${userId}` : `ip:${req.ip || 'unknown'}`;
};

/**
 * Aggressive limit for auth endpoints — brute-force protection.
 * 10 attempts per 15 min per IP.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
  skipSuccessfulRequests: true, // Only count failed attempts so legit users aren't blocked
});

/**
 * Limit for Claude Vision scan — protects Anthropic budget.
 * 30 scans per hour per user (matches CLAUDE_SCAN_MAX_CALLS default).
 */
export const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: 'Quota de scan atteint. Réessayez dans une heure.' },
});

/**
 * Limit for AI deck builder — protects Anthropic budget.
 * 15 requests per hour per user (Sonnet is more expensive than Haiku).
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: "Quota IA atteint. Réessayez dans une heure." },
});

/**
 * Loose global limit to catch runaway clients / obvious abuse.
 * 300 requests per minute per IP.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Ralentis un peu.' },
});
