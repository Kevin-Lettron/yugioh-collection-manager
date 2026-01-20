/// <reference types="jest" />
/**
 * Unit tests for SocialController
 * Tests social features: follow/unfollow, wishlist operations
 */

import { Request, Response, NextFunction } from 'express';
import { SocialController } from '../../controllers/socialController';
import { FollowModel } from '../../models/followModel';
import { WishlistModel } from '../../models/wishlistModel';
import { UserModel } from '../../models/userModel';
import { DeckModel } from '../../models/deckModel';
import { NotificationModel } from '../../models/notificationModel';
import { AuthRequest } from '../../middleware/authMiddleware';

// Mock dependencies
jest.mock('../../models/followModel');
jest.mock('../../models/wishlistModel');
jest.mock('../../models/userModel');
jest.mock('../../models/deckModel');
jest.mock('../../models/notificationModel');
jest.mock('../../utils/logger', () => ({
  loggers: {
    social: {
      follow: jest.fn(),
      unfollow: jest.fn(),
    },
  },
}));

const mockFollowModel = FollowModel as jest.Mocked<typeof FollowModel>;
const mockWishlistModel = WishlistModel as jest.Mocked<typeof WishlistModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockDeckModel = DeckModel as jest.Mocked<typeof DeckModel>;
const mockNotificationModel = NotificationModel as jest.Mocked<typeof NotificationModel>;

describe('SocialController', () => {
  // Mock Express objects
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  // Mock data
  const mockUser = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
  };

  const mockOtherUser = {
    id: 2,
    username: 'otheruser',
    email: 'other@example.com',
    profile_picture: undefined as string | undefined,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockFollow = {
    id: 1,
    follower_id: 1,
    following_id: 2,
    created_at: new Date('2024-01-01'),
  };

  const mockDeck = {
    id: 1,
    user_id: 2,
    name: 'Public Deck',
    cover_image: undefined as string | undefined,
    is_public: true,
    respect_banlist: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockWishlist = {
    id: 1,
    user_id: 1,
    original_deck_id: 1,
    created_at: new Date('2024-01-01'),
  };

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: mockUser,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('followUser', () => {
    it('should follow a user successfully', async () => {
      mockRequest.params = { userId: '2' };

      mockUserModel.findById.mockResolvedValue(mockOtherUser);
      mockFollowModel.isFollowing.mockResolvedValue(false);
      mockFollowModel.follow.mockResolvedValue(mockFollow);
      mockNotificationModel.exists.mockResolvedValue(false);
      mockNotificationModel.create.mockResolvedValue({
        id: 1,
        user_id: 2,
        type: 'follow',
        from_user_id: 1,
        is_read: false,
        created_at: new Date(),
      });

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockFollowModel.follow).toHaveBeenCalledWith(1, 2);
      expect(mockNotificationModel.create).toHaveBeenCalledWith(2, 'follow', 1);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Successfully followed user',
        follow: mockFollow,
      });
    });

    it('should fail when not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: '2' };

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should fail with invalid user ID', async () => {
      mockRequest.params = { userId: 'invalid' };

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid user ID',
      }));
    });

    it('should fail when trying to follow yourself', async () => {
      mockRequest.params = { userId: '1' };

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You cannot follow yourself',
      }));
    });

    it('should fail when user to follow does not exist', async () => {
      mockRequest.params = { userId: '999' };

      mockUserModel.findById.mockResolvedValue(null);

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'User not found',
      }));
    });

    it('should fail when already following user', async () => {
      mockRequest.params = { userId: '2' };

      mockUserModel.findById.mockResolvedValue(mockOtherUser);
      mockFollowModel.isFollowing.mockResolvedValue(true);

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You are already following this user',
      }));
    });

    it('should not create duplicate notification', async () => {
      mockRequest.params = { userId: '2' };

      mockUserModel.findById.mockResolvedValue(mockOtherUser);
      mockFollowModel.isFollowing.mockResolvedValue(false);
      mockFollowModel.follow.mockResolvedValue(mockFollow);
      mockNotificationModel.exists.mockResolvedValue(true);

      await SocialController.followUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNotificationModel.create).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('unfollowUser', () => {
    it('should unfollow a user successfully', async () => {
      mockRequest.params = { userId: '2' };

      mockFollowModel.unfollow.mockResolvedValue(true);

      await SocialController.unfollowUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockFollowModel.unfollow).toHaveBeenCalledWith(1, 2);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Successfully unfollowed user',
      });
    });

    it('should fail when not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { userId: '2' };

      await SocialController.unfollowUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should fail with invalid user ID', async () => {
      mockRequest.params = { userId: 'invalid' };

      await SocialController.unfollowUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid user ID',
      }));
    });

    it('should fail when not following the user', async () => {
      mockRequest.params = { userId: '2' };

      mockFollowModel.unfollow.mockResolvedValue(false);

      await SocialController.unfollowUser(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You are not following this user',
      }));
    });
  });

  describe('getFollowers', () => {
    it('should return paginated followers list', async () => {
      mockRequest.params = { userId: '1' };
      mockRequest.query = { page: '1', limit: '50' };

      mockFollowModel.getFollowers.mockResolvedValue({
        followers: [mockOtherUser],
        total: 1,
      });

      await SocialController.getFollowers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockFollowModel.getFollowers).toHaveBeenCalledWith(1, 50, 0);
      expect(mockResponse.json).toHaveBeenCalledWith({
        followers: [mockOtherUser],
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      });
    });

    it('should fail with invalid user ID', async () => {
      mockRequest.params = { userId: 'invalid' };

      await SocialController.getFollowers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid user ID',
      }));
    });

    it('should handle pagination correctly', async () => {
      mockRequest.params = { userId: '1' };
      mockRequest.query = { page: '2', limit: '10' };

      mockFollowModel.getFollowers.mockResolvedValue({
        followers: [],
        total: 15,
      });

      await SocialController.getFollowers(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockFollowModel.getFollowers).toHaveBeenCalledWith(1, 10, 10);
      expect(mockResponse.json).toHaveBeenCalledWith({
        followers: [],
        total: 15,
        page: 2,
        limit: 10,
        total_pages: 2,
      });
    });
  });

  describe('getFollowing', () => {
    it('should return paginated following list', async () => {
      mockRequest.params = { userId: '1' };
      mockRequest.query = { page: '1', limit: '50' };

      mockFollowModel.getFollowing.mockResolvedValue({
        following: [mockOtherUser],
        total: 1,
      });

      await SocialController.getFollowing(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockFollowModel.getFollowing).toHaveBeenCalledWith(1, 50, 0);
      expect(mockResponse.json).toHaveBeenCalledWith({
        following: [mockOtherUser],
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      });
    });

    it('should fail with invalid user ID', async () => {
      mockRequest.params = { userId: 'invalid' };

      await SocialController.getFollowing(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid user ID',
      }));
    });
  });

  describe('addToWishlist', () => {
    it('should add public deck to wishlist successfully', async () => {
      mockRequest.params = { deckId: '1' };

      mockDeckModel.findById.mockResolvedValue(mockDeck);
      mockWishlistModel.isInWishlist.mockResolvedValue(false);
      mockWishlistModel.addToWishlist.mockResolvedValue(mockWishlist);

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockDeckModel.findById).toHaveBeenCalledWith(1);
      expect(mockWishlistModel.addToWishlist).toHaveBeenCalledWith(1, 1);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Deck added to wishlist',
        wishlist: mockWishlist,
      });
    });

    it('should allow adding own private deck to wishlist', async () => {
      mockRequest.params = { deckId: '1' };

      const privateDeck = { ...mockDeck, is_public: false, user_id: 1 };
      mockDeckModel.findById.mockResolvedValue(privateDeck);
      mockWishlistModel.isInWishlist.mockResolvedValue(false);
      mockWishlistModel.addToWishlist.mockResolvedValue(mockWishlist);

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should fail when not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { deckId: '1' };

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should fail with invalid deck ID', async () => {
      mockRequest.params = { deckId: 'invalid' };

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid deck ID',
      }));
    });

    it('should fail when deck not found', async () => {
      mockRequest.params = { deckId: '999' };

      mockDeckModel.findById.mockResolvedValue(null);

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Deck not found',
      }));
    });

    it('should fail when trying to wishlist private deck of another user', async () => {
      mockRequest.params = { deckId: '1' };

      const privateDeck = { ...mockDeck, is_public: false, user_id: 2 };
      mockDeckModel.findById.mockResolvedValue(privateDeck);

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'You cannot wishlist a private deck',
      }));
    });

    it('should fail when deck already in wishlist', async () => {
      mockRequest.params = { deckId: '1' };

      mockDeckModel.findById.mockResolvedValue(mockDeck);
      mockWishlistModel.isInWishlist.mockResolvedValue(true);

      await SocialController.addToWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Deck is already in your wishlist',
      }));
    });
  });

  describe('removeFromWishlist', () => {
    it('should remove deck from wishlist successfully', async () => {
      mockRequest.params = { deckId: '1' };

      mockWishlistModel.removeFromWishlist.mockResolvedValue(true);

      await SocialController.removeFromWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockWishlistModel.removeFromWishlist).toHaveBeenCalledWith(1, 1);
      expect(mockResponse.json).toHaveBeenCalledWith({
        message: 'Deck removed from wishlist',
      });
    });

    it('should fail when not authenticated', async () => {
      mockRequest.user = undefined;
      mockRequest.params = { deckId: '1' };

      await SocialController.removeFromWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should fail with invalid deck ID', async () => {
      mockRequest.params = { deckId: 'invalid' };

      await SocialController.removeFromWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid deck ID',
      }));
    });

    it('should fail when deck not in wishlist', async () => {
      mockRequest.params = { deckId: '999' };

      mockWishlistModel.removeFromWishlist.mockResolvedValue(false);

      await SocialController.removeFromWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Deck not found in wishlist',
      }));
    });
  });

  describe('getWishlist', () => {
    it('should return paginated wishlist', async () => {
      mockRequest.query = { page: '1', limit: '50' };

      mockWishlistModel.getUserWishlist.mockResolvedValue({
        wishlists: [{ ...mockWishlist, deck: mockDeck }],
        total: 1,
      });

      await SocialController.getWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockWishlistModel.getUserWishlist).toHaveBeenCalledWith(1, 50, 0);
      expect(mockResponse.json).toHaveBeenCalledWith({
        wishlists: [{ ...mockWishlist, deck: mockDeck }],
        total: 1,
        page: 1,
        limit: 50,
        total_pages: 1,
      });
    });

    it('should fail when not authenticated', async () => {
      mockRequest.user = undefined;

      await SocialController.getWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Not authenticated',
      }));
    });

    it('should handle pagination correctly', async () => {
      mockRequest.query = { page: '2', limit: '10' };

      mockWishlistModel.getUserWishlist.mockResolvedValue({
        wishlists: [],
        total: 15,
      });

      await SocialController.getWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockWishlistModel.getUserWishlist).toHaveBeenCalledWith(1, 10, 10);
      expect(mockResponse.json).toHaveBeenCalledWith({
        wishlists: [],
        total: 15,
        page: 2,
        limit: 10,
        total_pages: 2,
      });
    });

    it('should return empty wishlist', async () => {
      mockRequest.query = {};

      mockWishlistModel.getUserWishlist.mockResolvedValue({
        wishlists: [],
        total: 0,
      });

      await SocialController.getWishlist(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        wishlists: [],
        total: 0,
        page: 1,
        limit: 50,
        total_pages: 0,
      });
    });
  });
});
