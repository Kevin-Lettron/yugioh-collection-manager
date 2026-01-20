import jwt from 'jsonwebtoken';

interface JWTPayload {
  id: number;
  email: string;
  username: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

  // @ts-ignore - TypeScript has issues with jwt.sign return type
  return jwt.sign(payload, secret, { expiresIn: '7d' });
};

export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
  return jwt.verify(token, secret) as JWTPayload;
};
