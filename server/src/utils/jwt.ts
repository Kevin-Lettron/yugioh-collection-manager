import jwt from 'jsonwebtoken';
import { getRequiredEnv } from './env';

interface JWTPayload {
  id: number;
  email: string;
  username: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const secret = getRequiredEnv('JWT_SECRET');
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  // @ts-ignore - TypeScript has issues with jwt.sign return type
  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): JWTPayload => {
  const secret = getRequiredEnv('JWT_SECRET');
  return jwt.verify(token, secret) as JWTPayload;
};
