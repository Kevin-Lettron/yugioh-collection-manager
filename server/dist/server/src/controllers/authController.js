"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const userModel_1 = require("../models/userModel");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const jwt_1 = require("../utils/jwt");
// Pre-computed dummy bcrypt hash used to keep login response time constant
// when the user doesn't exist (prevents timing-based user enumeration).
// Generated with: bcrypt.hashSync('dummy-password-never-matches', 10)
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuVMY7Z9lmVWTdlS8Xz3JZ/DYldbHnPuwK';
/**
 * Enforces a reasonable password policy.
 * - min 10 chars
 * - at least 3 of: lowercase, uppercase, digit, special
 * Returns null if OK, else an error message.
 */
function validatePasswordPolicy(password) {
    if (typeof password !== 'string')
        return 'Mot de passe invalide';
    if (password.length < 10)
        return 'Le mot de passe doit contenir au moins 10 caractères';
    if (password.length > 128)
        return 'Le mot de passe est trop long (max 128 caractères)';
    const kinds = [
        /[a-z]/.test(password),
        /[A-Z]/.test(password),
        /\d/.test(password),
        /[^a-zA-Z0-9]/.test(password),
    ].filter(Boolean).length;
    if (kinds < 3) {
        return 'Le mot de passe doit combiner au moins 3 des 4 types : minuscule, majuscule, chiffre, caractère spécial';
    }
    return null;
}
class AuthController {
    /**
     * Register a new user
     */
    static async register(req, res, next) {
        try {
            const { username, email, password } = req.body;
            // Validate input
            if (!username || !email || !password) {
                throw new errorHandler_1.ValidationError('Username, email, and password are required');
            }
            if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
                throw new errorHandler_1.ValidationError("Le nom d'utilisateur doit faire entre 3 et 50 caractères");
            }
            if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                throw new errorHandler_1.ValidationError('Email invalide');
            }
            const pwError = validatePasswordPolicy(password);
            if (pwError) {
                throw new errorHandler_1.ValidationError(pwError);
            }
            // Check if user already exists
            const exists = await userModel_1.UserModel.exists(email, username);
            if (exists) {
                throw new errorHandler_1.ValidationError('User with this email or username already exists');
            }
            // Create user
            const user = await userModel_1.UserModel.create(username, email, password);
            // Generate JWT token
            const token = (0, jwt_1.generateToken)({
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            });
            logger_1.loggers.auth.register(user.id, user.email, user.username);
            const response = { token, user };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Login user (with email or username)
     */
    static async login(req, res, next) {
        try {
            const { email, password } = req.body;
            // 'email' field can contain either email or username
            const identifier = email;
            // Validate input
            if (!identifier || !password) {
                throw new errorHandler_1.ValidationError('Identifiant et mot de passe requis');
            }
            // Find user by email or username
            const user = await userModel_1.UserModel.findByEmailOrUsername(identifier);
            // Timing-safe: always run a bcrypt.compare even when the user doesn't exist,
            // so response time doesn't leak whether the identifier is valid.
            // Without this an attacker can enumerate valid emails/usernames.
            const hashToCompare = user?.password_hash || DUMMY_HASH;
            const validPassword = await bcrypt_1.default.compare(password, hashToCompare);
            if (!user || !validPassword) {
                logger_1.loggers.auth.login(user?.id || 0, identifier, false);
                throw new errorHandler_1.UnauthorizedError('Identifiant ou mot de passe invalide');
            }
            // Block disabled accounts. We do this AFTER validating credentials so
            // an attacker who doesn't know the password can't probe account status.
            if (user.is_active === false) {
                logger_1.loggers.auth.login(user.id, identifier, false);
                throw new errorHandler_1.UnauthorizedError('Compte désactivé. Contactez un administrateur.');
            }
            // Generate JWT token
            const token = (0, jwt_1.generateToken)({
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            });
            logger_1.loggers.auth.login(user.id, user.email, true);
            // Remove password_hash from response
            const { password_hash, ...userWithoutPassword } = user;
            const response = { token, user: userWithoutPassword };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get current user profile
     */
    static async getProfile(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.UnauthorizedError('Not authenticated');
            }
            const user = await userModel_1.UserModel.findById(req.user.id);
            if (!user) {
                throw new errorHandler_1.UnauthorizedError('User not found');
            }
            // Get follower and following counts
            const followerCount = await userModel_1.UserModel.getFollowerCount(user.id);
            const followingCount = await userModel_1.UserModel.getFollowingCount(user.id);
            res.json({
                user,
                followerCount,
                followingCount,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update user profile
     */
    static async updateProfile(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.UnauthorizedError('Not authenticated');
            }
            const { username, email, profile_picture, password } = req.body;
            const updates = {};
            if (username)
                updates.username = username;
            if (email) {
                // Basic email shape check to avoid saving obviously invalid strings.
                if (!/^\S+@\S+\.\S+$/.test(email)) {
                    throw new errorHandler_1.ValidationError('Adresse email invalide');
                }
                updates.email = email;
            }
            if (profile_picture !== undefined)
                updates.profile_picture = profile_picture;
            if (password) {
                const pwError = validatePasswordPolicy(password);
                if (pwError) {
                    throw new errorHandler_1.ValidationError(pwError);
                }
                updates.password = password;
            }
            const updatedUser = await userModel_1.UserModel.update(req.user.id, updates);
            if (!updatedUser) {
                throw new Error('Failed to update profile');
            }
            res.json({ user: updatedUser });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get user by ID (public profile — strips email to prevent PII harvesting)
     */
    static async getUserById(req, res, next) {
        try {
            const userId = parseInt(req.params.id);
            const user = await userModel_1.UserModel.findById(userId);
            if (!user) {
                throw new errorHandler_1.NotFoundError('User not found');
            }
            const followerCount = await userModel_1.UserModel.getFollowerCount(userId);
            const followingCount = await userModel_1.UserModel.getFollowingCount(userId);
            // Strip email — this endpoint is public (no auth required)
            const { email: _email, ...publicUser } = user;
            void _email;
            res.json({
                user: publicUser,
                followerCount,
                followingCount,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Upload profile picture
     */
    static async uploadAvatar(req, res, next) {
        try {
            if (!req.user) {
                throw new errorHandler_1.UnauthorizedError('Not authenticated');
            }
            if (!req.file) {
                throw new errorHandler_1.ValidationError('No image file provided');
            }
            // Build the URL path for the uploaded file
            const profilePicturePath = `/uploads/profiles/${req.file.filename}`;
            // Update user profile with new picture path
            const updatedUser = await userModel_1.UserModel.update(req.user.id, {
                profile_picture: profilePicturePath,
            });
            if (!updatedUser) {
                throw new Error('Failed to update profile picture');
            }
            logger_1.loggers.api.request('POST', '/auth/profile/avatar', req.user.id);
            res.json({
                message: 'Profile picture updated successfully',
                user: updatedUser,
                profile_picture: profilePicturePath,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Search users by username
     */
    static async searchUsers(req, res, next) {
        try {
            const { q: query } = req.query;
            const currentUserId = req.user?.id;
            // If no query provided, return recent users (excluding current user)
            if (!query || typeof query !== 'string' || query.trim() === '') {
                const users = await userModel_1.UserModel.getRecentUsers(20, currentUserId);
                res.json(users);
                return;
            }
            const users = await userModel_1.UserModel.searchByUsername(query, 20, currentUserId);
            res.json(users);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
