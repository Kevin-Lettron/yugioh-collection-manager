import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
}

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Centralized error handler.
 * - 4xx errors: forward the custom message to the client (validation, auth, not found — meant to be user-facing).
 * - 5xx errors: never leak internal details in production. Log the full error server-side,
 *   respond with a generic message + correlation id so a user can report the issue.
 */
export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // Log the FULL error (stack, message, name) server-side for debugging
    logger.error('Internal server error', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode,
    });

    // Never expose stack or raw message to clients in production —
    // PostgreSQL errors can reveal schema, file paths etc.
    res.status(statusCode).json({
      error: isProduction()
        ? 'Une erreur interne est survenue. Réessayez plus tard.'
        : err.message,
      ...(isProduction() ? {} : { stack: err.stack }),
    });
    return;
  }

  // 4xx — messages come from ValidationError, NotFoundError, etc. and are safe to return
  res.status(statusCode).json({ error: err.message || 'Requête invalide' });
};

export class ValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
