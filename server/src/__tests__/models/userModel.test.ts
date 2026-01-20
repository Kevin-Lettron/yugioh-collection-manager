/// <reference types="jest" />
/**
 * Unit tests for UserModel
 * Tests user CRUD operations with mocked database
 */

import { UserModel } from '../../models/userModel';
import * as database from '../../config/database';
import bcrypt from 'bcrypt';

// Mock the database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

describe('UserModel', () => {
  // Mock data
  const mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    profile_picture: null,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockUserWithPassword = {
    ...mockUser,
    password_hash: 'hashed_password_123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user with hashed password', async () => {
      const username = 'newuser';
      const email = 'newuser@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password_xyz';

      mockBcryptHash.mockResolvedValue(hashedPassword as never);
      mockQuery.mockResolvedValue({
        rows: [{ ...mockUser, username, email }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.create(username, email, password);

      expect(mockBcryptHash).toHaveBeenCalledWith(password, 10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [username, email, hashedPassword]
      );
      expect(result.username).toBe(username);
      expect(result.email).toBe(email);
    });

    it('should throw error if database insert fails', async () => {
      mockBcryptHash.mockResolvedValue('hashed' as never);
      mockQuery.mockRejectedValue(new Error('Database error'));

      await expect(
        UserModel.create('user', 'user@example.com', 'password')
      ).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findById(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return user with password_hash when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockUserWithPassword],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findByEmail('test@example.com');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1'),
        ['test@example.com']
      );
      expect(result).toEqual(mockUserWithPassword);
      expect(result?.password_hash).toBe('hashed_password_123');
    });

    it('should return null when email not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return user when found', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findByUsername('testuser');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE username = $1'),
        ['testuser']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return null when username not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchByUsername', () => {
    it('should return matching users', async () => {
      const mockUsers = [
        mockUser,
        { ...mockUser, id: 2, username: 'testuser2' },
      ];

      mockQuery.mockResolvedValue({
        rows: mockUsers,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.searchByUsername('test');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%test%', 20]
      );
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.searchByUsername('xyz123');

      expect(result).toEqual([]);
    });

    it('should respect custom limit parameter', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      await UserModel.searchByUsername('test', 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5]
      );
    });
  });

  describe('update', () => {
    it('should update username', async () => {
      const updatedUser = { ...mockUser, username: 'newusername' };
      mockQuery.mockResolvedValue({
        rows: [updatedUser],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.update(1, { username: 'newusername' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining(['newusername', 1])
      );
      expect(result?.username).toBe('newusername');
    });

    it('should update email', async () => {
      const updatedUser = { ...mockUser, email: 'newemail@example.com' };
      mockQuery.mockResolvedValue({
        rows: [updatedUser],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.update(1, { email: 'newemail@example.com' });

      expect(result?.email).toBe('newemail@example.com');
    });

    it('should update profile_picture', async () => {
      const updatedUser = { ...mockUser, profile_picture: 'http://example.com/pic.jpg' };
      mockQuery.mockResolvedValue({
        rows: [updatedUser],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.update(1, { profile_picture: 'http://example.com/pic.jpg' });

      expect(result?.profile_picture).toBe('http://example.com/pic.jpg');
    });

    it('should return existing user when no updates provided', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockUser],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.update(1, {});

      // Should call findById instead of UPDATE
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'UPDATE',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.update(999, { username: 'test' });

      expect(result).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('should return true for valid password', async () => {
      mockBcryptCompare.mockResolvedValue(true as never);

      const result = await UserModel.verifyPassword('password123', 'hashed_password');

      expect(mockBcryptCompare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(result).toBe(true);
    });

    it('should return false for invalid password', async () => {
      mockBcryptCompare.mockResolvedValue(false as never);

      const result = await UserModel.verifyPassword('wrongpassword', 'hashed_password');

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when user exists by email', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.exists('test@example.com', 'differentusername');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1 OR username = $2'),
        ['test@example.com', 'differentusername']
      );
      expect(result).toBe(true);
    });

    it('should return true when user exists by username', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 1 }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.exists('different@example.com', 'testuser');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.exists('new@example.com', 'newuser');

      expect(result).toBe(false);
    });
  });

  describe('getFollowerCount', () => {
    it('should return correct follower count', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ count: '15' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.getFollowerCount(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('follows WHERE following_id'),
        [1]
      );
      expect(result).toBe(15);
    });

    it('should return 0 when no followers', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.getFollowerCount(1);

      expect(result).toBe(0);
    });
  });

  describe('getFollowingCount', () => {
    it('should return correct following count', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ count: '10' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.getFollowingCount(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('follows WHERE follower_id'),
        [1]
      );
      expect(result).toBe(10);
    });

    it('should return 0 when not following anyone', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ count: '0' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await UserModel.getFollowingCount(1);

      expect(result).toBe(0);
    });
  });
});
