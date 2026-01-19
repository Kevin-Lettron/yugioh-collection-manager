import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
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
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
    const decoded = jwt.verify(token, jwtSecret) as {
      id: number;
      email: string;
      username: string;
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
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
    const decoded = jwt.verify(token, jwtSecret) as {
      id: number;
      email: string;
      username: string;
    };

    req.user = decoded;
  } catch (error) {
    // Token invalid, but continue without auth
  }

  next();
};
