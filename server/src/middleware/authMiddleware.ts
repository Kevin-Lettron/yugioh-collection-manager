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

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
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
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
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
