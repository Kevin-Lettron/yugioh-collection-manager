/// <reference types="jest" />
/**
 * Unit tests for AuthController
 * Tests authentication endpoints with mocked dependencies
 */

import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../controllers/authController';
import { UserModel } from '../../models/userModel';
import { AuthRequest } from '../../middleware/authMiddleware';
import * as jwt from '../../utils/jwt';

// Mock dependencies
jest.mock('../../models/userModel');
jest.mock('../../utils/jwt');
jest.mock('../../utils/logger', () => ({
  loggers: {
    auth: {
      register: jest.fn(),
      login: jest.fn(),
    },
  },
}));

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockGenerateToken = jwt.generateToken as jest.MockedFunction<typeof jwt.generateToken>;

describe('AuthController', () => {
  // Mock Express objects
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  // Mock user data
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    profile_picture: undefined as string | undefined,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockUserWithPassword = {
    ...mockUser,
    password_hash: 'hashed_password_123',
  };

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user with valid data', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      mockUserModel.exists.mockResolvedValue(false);
      mockUserModel.create.mockResolvedValue(mockUser);
      mockGenerateToken.mockReturnValue('mock_jwt_token');

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.exists).toHaveBeenCalledWith('newuser@example.com', 'newuser');
      expect(mockUserModel.create).toHaveBeenCalledWith('newuser', 'newuser@example.com', 'password123');
      expect(mockGenerateToken).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'mock_jwt_token',
        user: mockUser,
      });
    });

    it('should fail when username is missing', async () => {
      mockRequest.body = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Username, email, and password are required',
      }));
    });

    it('should fail when email is missing', async () => {
      mockRequest.body = {
        username: 'newuser',
        password: 'password123',
      };

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Username, email, and password are required',
      }));
    });

    it('should fail when password is missing', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'newuser@example.com',
      };

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Username, email, and password are required',
      }));
    });

    it('should fail when password is too short', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: '12345',
      };

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Password must be at least 6 characters long',
      }));
    });

    it('should fail when user already exists with same email', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };

      mockUserModel.exists.mockResolvedValue(true);

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User with this email or username already exists',
      }));
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should fail when user already exists with same username', async () => {
      mockRequest.body = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123',
      };

      mockUserModel.exists.mockResolvedValue(true);

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User with this email or username already exists',
      }));
    });

    it('should handle database errors gracefully', async () => {
      mockRequest.body = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      mockUserModel.exists.mockResolvedValue(false);
      mockUserModel.create.mockRejectedValue(new Error('Database error'));

      await AuthController.register(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserModel.verifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock_jwt_token');

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserModel.verifyPassword).toHaveBeenCalledWith('password123', 'hashed_password_123');
      expect(mockGenerateToken).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        token: 'mock_jwt_token',
        user: mockUser,
      });
    });

    it('should fail when email is missing', async () => {
      mockRequest.body = {
        password: 'password123',
      };

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Email and password are required',
      }));
    });

    it('should fail when password is missing', async () => {
      mockRequest.body = {
        email: 'test@example.com',
      };

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Email and password are required',
      }));
    });

    it('should fail when email not found', async () => {
      mockRequest.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockUserModel.findByEmail.mockResolvedValue(null);

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid email or password',
      }));
    });

    it('should fail with wrong password', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserModel.verifyPassword.mockResolvedValue(false);

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid email or password',
      }));
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should not expose password_hash in response', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserModel.findByEmail.mockResolvedValue(mockUserWithPassword);
      mockUserModel.verifyPassword.mockResolvedValue(true);
      mockGenerateToken.mockReturnValue('mock_jwt_token');

      await AuthController.login(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseArg = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseArg.user.password_hash).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('should return user profile when authenticated', async () => {
      const authRequest = {
        ...mockRequest,
        user: { id: 1, email: 'test@example.com', username: 'testuser' },
      } as AuthRequest;

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.getFollowerCount.mockResolvedValue(10);
      mockUserModel.getFollowingCount.mockResolvedValue(5);

      await AuthController.getProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.findById).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockUser,
        followerCount: 10,
        followingCount: 5,
      });
    });

    it('should fail when not authenticated', async () => {
      const authRequest = {
        ...mockRequest,
        user: undefined,
      } as AuthRequest;

      await AuthController.getProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should fail when user not found in database', async () => {
      const authRequest = {
        ...mockRequest,
        user: { id: 999, email: 'test@example.com', username: 'testuser' },
      } as AuthRequest;

      mockUserModel.findById.mockResolvedValue(null);

      await AuthController.getProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User not found',
      }));
    });
  });

  describe('updateProfile', () => {
    it('should update username successfully', async () => {
      const authRequest = {
        ...mockRequest,
        body: { username: 'newusername' },
        user: { id: 1, email: 'test@example.com', username: 'testuser' },
      } as AuthRequest;

      const updatedUser = { ...mockUser, username: 'newusername' };
      mockUserModel.update.mockResolvedValue(updatedUser);

      await AuthController.updateProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.update).toHaveBeenCalledWith(1, { username: 'newusername' });
      expect(mockResponse.json).toHaveBeenCalledWith({ user: updatedUser });
    });

    it('should update profile_picture successfully', async () => {
      const authRequest = {
        ...mockRequest,
        body: { profile_picture: 'http://example.com/pic.jpg' },
        user: { id: 1, email: 'test@example.com', username: 'testuser' },
      } as AuthRequest;

      const updatedUser = { ...mockUser, profile_picture: 'http://example.com/pic.jpg' };
      mockUserModel.update.mockResolvedValue(updatedUser);

      await AuthController.updateProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.update).toHaveBeenCalledWith(1, { profile_picture: 'http://example.com/pic.jpg' });
    });

    it('should fail when not authenticated', async () => {
      const authRequest = {
        ...mockRequest,
        body: { username: 'newusername' },
        user: undefined,
      } as AuthRequest;

      await AuthController.updateProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should handle update failure', async () => {
      const authRequest = {
        ...mockRequest,
        body: { username: 'newusername' },
        user: { id: 1, email: 'test@example.com', username: 'testuser' },
      } as AuthRequest;

      mockUserModel.update.mockResolvedValue(null);

      await AuthController.updateProfile(
        authRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getUserById', () => {
    it('should return public user profile', async () => {
      mockRequest.params = { id: '1' };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.getFollowerCount.mockResolvedValue(10);
      mockUserModel.getFollowingCount.mockResolvedValue(5);

      await AuthController.getUserById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.findById).toHaveBeenCalledWith(1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        user: mockUser,
        followerCount: 10,
        followingCount: 5,
      });
    });

    it('should fail when user not found', async () => {
      mockRequest.params = { id: '999' };

      mockUserModel.findById.mockResolvedValue(null);

      await AuthController.getUserById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User not found',
      }));
    });
  });

  describe('searchUsers', () => {
    it('should return matching users', async () => {
      mockRequest.query = { q: 'test' };

      const mockUsers = [mockUser, { ...mockUser, id: 2, username: 'test2' }];
      mockUserModel.searchByUsername.mockResolvedValue(mockUsers);

      await AuthController.searchUsers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockUserModel.searchByUsername).toHaveBeenCalledWith('test', 20);
      expect(mockResponse.json).toHaveBeenCalledWith({ users: mockUsers });
    });

    it('should fail when search query is missing', async () => {
      mockRequest.query = {};

      await AuthController.searchUsers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Search query is required',
      }));
    });

    it('should fail when search query is not a string', async () => {
      mockRequest.query = { q: ['array', 'value'] };

      await AuthController.searchUsers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Search query is required',
      }));
    });
  });
});
