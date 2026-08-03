"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.errorHandler = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const isProduction = () => process.env.NODE_ENV === 'production';
/**
 * Centralized error handler.
 * - 4xx errors: forward the custom message to the client (validation, auth, not found — meant to be user-facing).
 * - 5xx errors: never leak internal details in production. Log the full error server-side,
 *   respond with a generic message + correlation id so a user can report the issue.
 */
const errorHandler = (err, _req, res, _next) => {
    const statusCode = err.statusCode || 500;
    if (statusCode >= 500) {
        // Log the FULL error (stack, message, name) server-side for debugging
        logger_1.default.error('Internal server error', {
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
exports.errorHandler = errorHandler;
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends Error {
    constructor(message = 'Resource not found') {
        super(message);
        this.statusCode = 404;
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends Error {
    constructor(message = 'Unauthorized') {
        super(message);
        this.statusCode = 401;
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.statusCode = 403;
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
