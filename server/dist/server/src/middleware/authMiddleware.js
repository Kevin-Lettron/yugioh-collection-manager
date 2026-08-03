"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireStrictAdmin = exports.requireAdmin = exports.optionalAuth = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../utils/env");
const database_1 = require("../config/database");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
    }
    let decoded;
    try {
        const jwtSecret = (0, env_1.getRequiredEnv)('JWT_SECRET');
        decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
    }
    catch {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
    }
    // Fetch current account status from DB. This is what makes disable/revoke
    // instant — a disabled user's token stops working immediately, without
    // waiting for the JWT expiration.
    try {
        const result = await (0, database_1.query)('SELECT is_active, role FROM users WHERE id = $1', [decoded.id]);
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
    }
    catch {
        res.status(500).json({ error: 'Failed to verify account status' });
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        next();
        return;
    }
    try {
        const jwtSecret = (0, env_1.getRequiredEnv)('JWT_SECRET');
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.user = decoded;
    }
    catch (error) {
        // Token invalid, but continue without auth
    }
    next();
};
exports.optionalAuth = optionalAuth;
/**
 * Require the requesting user to have role='admin' or 'moderator'.
 * ALWAYS re-fetches the role from the DB (never trusts the JWT alone) so
 * revocation is instant — a demoted admin loses access immediately, without
 * needing to wait for their token to expire.
 */
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    try {
        const result = await (0, database_1.query)('SELECT role FROM users WHERE id = $1', [req.user.id]);
        const role = result.rows[0]?.role;
        if (role !== 'admin' && role !== 'moderator') {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        req.user.role = role;
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
};
exports.requireAdmin = requireAdmin;
/**
 * Stricter variant — admin only, moderators denied.
 */
const requireStrictAdmin = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    try {
        const result = await (0, database_1.query)('SELECT role FROM users WHERE id = $1', [req.user.id]);
        const role = result.rows[0]?.role;
        if (role !== 'admin') {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        req.user.role = role;
        next();
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to verify admin access' });
    }
};
exports.requireStrictAdmin = requireStrictAdmin;
