import jwt from 'jsonwebtoken';

interface JWTPayload {
  id: number;
  email: string;
  username: string;
}

export const generateToken = (payload: JWTPayload): string => {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, { expiresIn });
};

export const verifyToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
  return jwt.verify(token, secret) as JWTPayload;
};
