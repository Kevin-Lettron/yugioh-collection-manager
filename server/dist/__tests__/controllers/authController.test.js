"use strict";
/// <reference types="jest" />
/**
 * Unit tests for AuthController
 * Tests authentication endpoints with mocked dependencies
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const authController_1 = require("../../controllers/authController");
const userModel_1 = require("../../models/userModel");
const jwt = __importStar(require("../../utils/jwt"));
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
const mockUserModel = userModel_1.UserModel;
const mockGenerateToken = jwt.generateToken;
describe('AuthController', () => {
    // Mock Express objects
    let mockRequest;
    let mockResponse;
    let mockNext;
    // Mock user data
    const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        profile_picture: undefined,
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Username, email, and password are required',
            }));
        });
        it('should fail when email is missing', async () => {
            mockRequest.body = {
                username: 'newuser',
                password: 'password123',
            };
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Username, email, and password are required',
            }));
        });
        it('should fail when password is missing', async () => {
            mockRequest.body = {
                username: 'newuser',
                email: 'newuser@example.com',
            };
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.register(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Email and password are required',
            }));
        });
        it('should fail when password is missing', async () => {
            mockRequest.body = {
                email: 'test@example.com',
            };
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.login(mockRequest, mockResponse, mockNext);
            const responseArg = mockResponse.json.mock.calls[0][0];
            expect(responseArg.user.password_hash).toBeUndefined();
        });
    });
    describe('getProfile', () => {
        it('should return user profile when authenticated', async () => {
            const authRequest = {
                ...mockRequest,
                user: { id: 1, email: 'test@example.com', username: 'testuser' },
            };
            mockUserModel.findById.mockResolvedValue(mockUser);
            mockUserModel.getFollowerCount.mockResolvedValue(10);
            mockUserModel.getFollowingCount.mockResolvedValue(5);
            await authController_1.AuthController.getProfile(authRequest, mockResponse, mockNext);
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
            };
            await authController_1.AuthController.getProfile(authRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail when user not found in database', async () => {
            const authRequest = {
                ...mockRequest,
                user: { id: 999, email: 'test@example.com', username: 'testuser' },
            };
            mockUserModel.findById.mockResolvedValue(null);
            await authController_1.AuthController.getProfile(authRequest, mockResponse, mockNext);
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
            };
            const updatedUser = { ...mockUser, username: 'newusername' };
            mockUserModel.update.mockResolvedValue(updatedUser);
            await authController_1.AuthController.updateProfile(authRequest, mockResponse, mockNext);
            expect(mockUserModel.update).toHaveBeenCalledWith(1, { username: 'newusername' });
            expect(mockResponse.json).toHaveBeenCalledWith({ user: updatedUser });
        });
        it('should update profile_picture successfully', async () => {
            const authRequest = {
                ...mockRequest,
                body: { profile_picture: 'http://example.com/pic.jpg' },
                user: { id: 1, email: 'test@example.com', username: 'testuser' },
            };
            const updatedUser = { ...mockUser, profile_picture: 'http://example.com/pic.jpg' };
            mockUserModel.update.mockResolvedValue(updatedUser);
            await authController_1.AuthController.updateProfile(authRequest, mockResponse, mockNext);
            expect(mockUserModel.update).toHaveBeenCalledWith(1, { profile_picture: 'http://example.com/pic.jpg' });
        });
        it('should fail when not authenticated', async () => {
            const authRequest = {
                ...mockRequest,
                body: { username: 'newusername' },
                user: undefined,
            };
            await authController_1.AuthController.updateProfile(authRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should handle update failure', async () => {
            const authRequest = {
                ...mockRequest,
                body: { username: 'newusername' },
                user: { id: 1, email: 'test@example.com', username: 'testuser' },
            };
            mockUserModel.update.mockResolvedValue(null);
            await authController_1.AuthController.updateProfile(authRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        });
    });
    describe('getUserById', () => {
        it('should return public user profile', async () => {
            mockRequest.params = { id: '1' };
            mockUserModel.findById.mockResolvedValue(mockUser);
            mockUserModel.getFollowerCount.mockResolvedValue(10);
            mockUserModel.getFollowingCount.mockResolvedValue(5);
            await authController_1.AuthController.getUserById(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.getUserById(mockRequest, mockResponse, mockNext);
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
            await authController_1.AuthController.searchUsers(mockRequest, mockResponse, mockNext);
            expect(mockUserModel.searchByUsername).toHaveBeenCalledWith('test', 20);
            expect(mockResponse.json).toHaveBeenCalledWith({ users: mockUsers });
        });
        it('should fail when search query is missing', async () => {
            mockRequest.query = {};
            await authController_1.AuthController.searchUsers(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Search query is required',
            }));
        });
        it('should fail when search query is not a string', async () => {
            mockRequest.query = { q: ['array', 'value'] };
            await authController_1.AuthController.searchUsers(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Search query is required',
            }));
        });
    });
});
