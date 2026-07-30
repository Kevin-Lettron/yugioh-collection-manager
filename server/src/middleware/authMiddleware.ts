import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getRequiredEnv } from '../utils/env';
import { UserRole } from '../../../shared/types';
import { query } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    role?: UserRole;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  let decoded: { id: number; email: string; username: string; role?: UserRole };
  try {
    const jwtSecret = getRequiredEnv('JWT_SECRET');
    decoded = jwt.verify(token, jwtSecret) as typeof decoded;
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  // Fetch current account status from DB. This is what makes disable/revoke
  // instant — a disabled user's token stops working immediately, without
  // waiting for the JWT expiration.
  try {
    const result = await query(
      'SELECT is_active, role FROM users WHERE id = $1',
      [decoded.id]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }
    if (result.rows[0].is_active === false) {
      res.status(403).json({ error: 'Compte désactivé. Contactez un administrateur.' });
      return;
    }
    // Refresh role from DB so promote/demote is also instant
    decoded.role = result.rows[0].role;
    req.user = decoded;
    next();
  } catch {
    res.status(500).json({ error: 'Failed to verify account status' });
  }
};

export const optionalAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const jwtSecret = getRequiredEnv('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret) as {
      id: number;
      email: string;
      username: string;
      role?: UserRole;
    };

    req.user = decoded;
  } catch (error) {
    // Token invalid, but continue without auth
  }

  next();
};

/**
 * Require the requesting user to have role='admin' or 'moderator'.
 * ALWAYS re-fetches the role from the DB (never trusts the JWT alone) so
 * revocation is instant — a demoted admin loses access immediately, without
 * needing to wait for their token to expire.
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const result = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const role = result.rows[0]?.role as UserRole | undefined;

    if (role !== 'admin' && role !== 'moderator') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.user.role = role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
};

/**
 * Stricter variant — admin only, moderators denied.
 */
export const requireStrictAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const result = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const role = result.rows[0]?.role as UserRole | undefined;

    if (role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.user.role = role;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin access' });
  }
};
