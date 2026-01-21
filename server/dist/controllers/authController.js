"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const userModel_1 = require("../models/userModel");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const jwt_1 = require("../utils/jwt");
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
            if (password.length < 6) {
                throw new errorHandler_1.ValidationError('Password must be at least 6 characters long');
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
            if (!user) {
                logger_1.loggers.auth.login(0, identifier, false);
                throw new errorHandler_1.UnauthorizedError('Identifiant ou mot de passe invalide');
            }
            // Verify password
            const validPassword = await userModel_1.UserModel.verifyPassword(password, user.password_hash);
            if (!validPassword) {
                logger_1.loggers.auth.login(user.id, identifier, false);
                throw new errorHandler_1.UnauthorizedError('Identifiant ou mot de passe invalide');
            }
            // Generate JWT token
            const token = (0, jwt_1.generateToken)({
                id: user.id,
                email: user.email,
                username: user.username,
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
            const { username, profile_picture } = req.body;
            const updates = {};
            if (username)
                updates.username = username;
            if (profile_picture !== undefined)
                updates.profile_picture = profile_picture;
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
     * Get user by ID (public profile)
     */
    static async getUserById(req, res, next) {
        try {
            const userId = parseInt(req.params.id);
            const user = await userModel_1.UserModel.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            const followerCount = await userModel_1.UserModel.getFollowerCount(userId);
            const followingCount = await userModel_1.UserModel.getFollowingCount(userId);
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
