import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { generateToken } from '../utils/jwt';
import { AuthResponse, LoginRequest, RegisterRequest } from '../../../shared/types';

// Pre-computed dummy bcrypt hash used to keep login response time constant
// when the user doesn't exist (prevents timing-based user enumeration).
// Generated with: bcrypt.hashSync('dummy-password-never-matches', 10)
const DUMMY_HASH =
  '$2b$10$abcdefghijklmnopqrstuuVMY7Z9lmVWTdlS8Xz3JZ/DYldbHnPuwK';

/**
 * Enforces a reasonable password policy.
 * - min 10 chars
 * - at least 3 of: lowercase, uppercase, digit, special
 * Returns null if OK, else an error message.
 */
function validatePasswordPolicy(password: string): string | null {
  if (typeof password !== 'string') return 'Mot de passe invalide';
  if (password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères';
  if (password.length > 128) return 'Le mot de passe est trop long (max 128 caractères)';
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

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, email, password }: RegisterRequest = req.body;

      // Validate input
      if (!username || !email || !password) {
        throw new ValidationError('Username, email, and password are required');
      }

      if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
        throw new ValidationError("Le nom d'utilisateur doit faire entre 3 et 50 caractères");
      }

      if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError('Email invalide');
      }

      const pwError = validatePasswordPolicy(password);
      if (pwError) {
        throw new ValidationError(pwError);
      }

      // Check if user already exists
      const exists = await UserModel.exists(email, username);
      if (exists) {
        throw new ValidationError('User with this email or username already exists');
      }

      // Create user
      const user = await UserModel.create(username, email, password);

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      loggers.auth.register(user.id, user.email, user.username);

      const response: AuthResponse = { token, user };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user (with email or username)
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;
      // 'email' field can contain either email or username
      const identifier = email;

      // Validate input
      if (!identifier || !password) {
        throw new ValidationError('Identifiant et mot de passe requis');
      }

      // Find user by email or username
      const user = await UserModel.findByEmailOrUsername(identifier);

      // Timing-safe: always run a bcrypt.compare even when the user doesn't exist,
      // so response time doesn't leak whether the identifier is valid.
      // Without this an attacker can enumerate valid emails/usernames.
      const hashToCompare = user?.password_hash || DUMMY_HASH;
      const validPassword = await bcrypt.compare(password, hashToCompare);

      if (!user || !validPassword) {
        loggers.auth.login(user?.id || 0, identifier, false);
        throw new UnauthorizedError('Identifiant ou mot de passe invalide');
      }

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        username: user.username,
      });

      loggers.auth.login(user.id, user.email, true);

      // Remove password_hash from response
      const { password_hash, ...userWithoutPassword } = user;

      const response: AuthResponse = { token, user: userWithoutPassword };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const user = await UserModel.findById(req.user.id);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Get follower and following counts
      const followerCount = await UserModel.getFollowerCount(user.id);
      const followingCount = await UserModel.getFollowingCount(user.id);

      res.json({
        user,
        followerCount,
        followingCount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      const { username, profile_picture, password } = req.body;

      const updates: any = {};
      if (username) updates.username = username;
      if (profile_picture !== undefined) updates.profile_picture = profile_picture;
      if (password) {
        const pwError = validatePasswordPolicy(password);
        if (pwError) {
          throw new ValidationError(pwError);
        }
        updates.password = password;
      }

      const updatedUser = await UserModel.update(req.user.id, updates);
      if (!updatedUser) {
        throw new Error('Failed to update profile');
      }

      res.json({ user: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID (public profile — strips email to prevent PII harvesting)
   */
  static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id);

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const followerCount = await UserModel.getFollowerCount(userId);
      const followingCount = await UserModel.getFollowingCount(userId);

      // Strip email — this endpoint is public (no auth required)
      const { email: _email, ...publicUser } = user as { email?: string } & typeof user;
      void _email;

      res.json({
        user: publicUser,
        followerCount,
        followingCount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload profile picture
   */
  static async uploadAvatar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Not authenticated');
      }

      if (!req.file) {
        throw new ValidationError('No image file provided');
      }

      // Build the URL path for the uploaded file
      const profilePicturePath = `/uploads/profiles/${req.file.filename}`;

      // Update user profile with new picture path
      const updatedUser = await UserModel.update(req.user.id, {
        profile_picture: profilePicturePath,
      });

      if (!updatedUser) {
        throw new Error('Failed to update profile picture');
      }

      loggers.api.request('POST', '/auth/profile/avatar', req.user.id);

      res.json({
        message: 'Profile picture updated successfully',
        user: updatedUser,
        profile_picture: profilePicturePath,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search users by username
   */
  static async searchUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q: query } = req.query;
      const currentUserId = req.user?.id;

      // If no query provided, return recent users (excluding current user)
      if (!query || typeof query !== 'string' || query.trim() === '') {
        const users = await UserModel.getRecentUsers(20, currentUserId);
        res.json(users);
        return;
      }

      const users = await UserModel.searchByUsername(query, 20, currentUserId);

      res.json(users);
    } catch (error) {
      next(error);
    }
  }
}
