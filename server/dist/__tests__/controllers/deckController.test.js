"use strict";
/// <reference types="jest" />
/**
 * Unit tests for DeckController
 * Tests deck CRUD endpoints with mocked dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
const deckController_1 = require("../../controllers/deckController");
const deckModel_1 = require("../../models/deckModel");
const cardModel_1 = require("../../models/cardModel");
// Mock dependencies
jest.mock('../../models/deckModel');
jest.mock('../../models/cardModel');
jest.mock('../../utils/logger', () => ({
    loggers: {
        deck: {
            created: jest.fn(),
            updated: jest.fn(),
            deleted: jest.fn(),
            validationError: jest.fn(),
        },
    },
}));
const mockDeckModel = deckModel_1.DeckModel;
const mockCardModel = cardModel_1.CardModel;
describe('DeckController', () => {
    // Mock Express objects
    let mockRequest;
    let mockResponse;
    let mockNext;
    // Mock data
    const mockUser = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
    };
    const mockDeck = {
        id: 1,
        user_id: 1,
        name: 'Test Deck',
        cover_image: undefined,
        is_public: true,
        respect_banlist: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            profile_picture: undefined,
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01'),
        },
        main_deck: [],
        extra_deck: [],
        likes_count: 5,
        dislikes_count: 2,
        comments_count: 10,
    };
    const mockCard = {
        id: 1,
        card_id: '46986414',
        name: 'Dark Magician',
        type: 'Normal Monster',
        frame_type: 'normal',
        description: 'The ultimate wizard',
        atk: 2500,
        def: 2100,
        level: 7,
        race: 'Spellcaster',
        attribute: 'DARK',
        archetype: 'Dark Magician',
        card_sets: [],
        card_images: [],
        card_prices: {},
        banlist_info: {},
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
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
    describe('createDeck', () => {
        it('should create a new deck successfully', async () => {
            mockRequest.body = {
                name: 'My New Deck',
                respect_banlist: true,
                is_public: true,
            };
            mockDeckModel.create.mockResolvedValue(mockDeck);
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.create).toHaveBeenCalledWith(1, 'My New Deck', true, true, undefined);
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Deck created successfully',
                deck: mockDeck,
            });
        });
        it('should create deck with cover image', async () => {
            mockRequest.body = {
                name: 'My New Deck',
                cover_image: 'http://example.com/cover.jpg',
            };
            mockDeckModel.create.mockResolvedValue({
                ...mockDeck,
                cover_image: 'http://example.com/cover.jpg',
            });
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.create).toHaveBeenCalledWith(1, 'My New Deck', true, true, 'http://example.com/cover.jpg');
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            mockRequest.body = { name: 'My New Deck' };
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail when deck name is missing', async () => {
            mockRequest.body = {};
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck name is required',
            }));
        });
        it('should fail when deck name is empty string', async () => {
            mockRequest.body = { name: '   ' };
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck name is required',
            }));
        });
        it('should fail when deck name exceeds 100 characters', async () => {
            mockRequest.body = { name: 'A'.repeat(101) };
            await deckController_1.DeckController.createDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck name cannot exceed 100 characters',
            }));
        });
    });
    describe('getUserDecks', () => {
        it('should return paginated user decks', async () => {
            mockRequest.query = { page: '1', limit: '20' };
            const paginatedResponse = {
                data: [mockDeck],
                total: 1,
                page: 1,
                limit: 20,
                total_pages: 1,
            };
            mockDeckModel.getUserDecks.mockResolvedValue(paginatedResponse);
            await deckController_1.DeckController.getUserDecks(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.getUserDecks).toHaveBeenCalledWith(1, {
                page: 1,
                limit: 20,
                search: undefined,
                respect_banlist: undefined,
            });
            expect(mockResponse.json).toHaveBeenCalledWith(paginatedResponse);
        });
        it('should apply search filter', async () => {
            mockRequest.query = { search: 'Test' };
            mockDeckModel.getUserDecks.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 20,
                total_pages: 0,
            });
            await deckController_1.DeckController.getUserDecks(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.getUserDecks).toHaveBeenCalledWith(1, expect.objectContaining({
                search: 'Test',
            }));
        });
        it('should apply respect_banlist filter', async () => {
            mockRequest.query = { respect_banlist: 'true' };
            mockDeckModel.getUserDecks.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 20,
                total_pages: 0,
            });
            await deckController_1.DeckController.getUserDecks(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.getUserDecks).toHaveBeenCalledWith(1, expect.objectContaining({
                respect_banlist: true,
            }));
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            await deckController_1.DeckController.getUserDecks(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
    });
    describe('getDeckById', () => {
        it('should return deck with full details', async () => {
            mockRequest.params = { id: '1' };
            mockDeckModel.findById.mockResolvedValue(mockDeck);
            await deckController_1.DeckController.getDeckById(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.findById).toHaveBeenCalledWith(1, 1);
            expect(mockResponse.json).toHaveBeenCalledWith({ deck: mockDeck });
        });
        it('should fail with invalid deck ID', async () => {
            mockRequest.params = { id: 'invalid' };
            await deckController_1.DeckController.getDeckById(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid deck ID',
            }));
        });
        it('should fail when deck not found', async () => {
            mockRequest.params = { id: '999' };
            mockDeckModel.findById.mockResolvedValue(null);
            await deckController_1.DeckController.getDeckById(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck not found',
            }));
        });
        it('should fail when viewing private deck without permission', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.user = { id: 2, email: 'other@example.com', username: 'other' };
            const privateDeck = { ...mockDeck, is_public: false, user_id: 1 };
            mockDeckModel.findById.mockResolvedValue(privateDeck);
            await deckController_1.DeckController.getDeckById(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'You do not have permission to view this deck',
            }));
        });
        it('should allow owner to view private deck', async () => {
            mockRequest.params = { id: '1' };
            const privateDeck = { ...mockDeck, is_public: false };
            mockDeckModel.findById.mockResolvedValue(privateDeck);
            await deckController_1.DeckController.getDeckById(mockRequest, mockResponse, mockNext);
            expect(mockResponse.json).toHaveBeenCalledWith({ deck: privateDeck });
        });
    });
    describe('updateDeck', () => {
        it('should update deck name', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { name: 'Updated Deck Name' };
            const updatedDeck = { ...mockDeck, name: 'Updated Deck Name' };
            mockDeckModel.update.mockResolvedValue(updatedDeck);
            await deckController_1.DeckController.updateDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.update).toHaveBeenCalledWith(1, 1, { name: 'Updated Deck Name' });
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Deck updated successfully',
                deck: updatedDeck,
            });
        });
        it('should update multiple fields', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = {
                name: 'Updated Name',
                is_public: false,
                respect_banlist: false,
            };
            mockDeckModel.update.mockResolvedValue(mockDeck);
            await deckController_1.DeckController.updateDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.update).toHaveBeenCalledWith(1, 1, {
                name: 'Updated Name',
                is_public: false,
                respect_banlist: false,
            });
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            mockRequest.params = { id: '1' };
            mockRequest.body = { name: 'Test' };
            await deckController_1.DeckController.updateDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail with empty deck name', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { name: '   ' };
            await deckController_1.DeckController.updateDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck name cannot be empty',
            }));
        });
        it('should fail when deck not found or unauthorized', async () => {
            mockRequest.params = { id: '999' };
            mockRequest.body = { name: 'Test' };
            mockDeckModel.update.mockResolvedValue(null);
            await deckController_1.DeckController.updateDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck not found or you do not have permission to update it',
            }));
        });
    });
    describe('deleteDeck', () => {
        it('should delete deck successfully', async () => {
            mockRequest.params = { id: '1' };
            mockDeckModel.delete.mockResolvedValue(true);
            await deckController_1.DeckController.deleteDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.delete).toHaveBeenCalledWith(1, 1);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Deck deleted successfully' });
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            mockRequest.params = { id: '1' };
            await deckController_1.DeckController.deleteDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail when deck not found or unauthorized', async () => {
            mockRequest.params = { id: '999' };
            mockDeckModel.delete.mockResolvedValue(false);
            await deckController_1.DeckController.deleteDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck not found or you do not have permission to delete it',
            }));
        });
    });
    describe('addCardToDeck', () => {
        it('should add card to deck successfully', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { card_id: 1, quantity: 3, is_extra_deck: false };
            mockCardModel.findById.mockResolvedValue(mockCard);
            mockDeckModel.addCard.mockResolvedValue({ success: true });
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockCardModel.findById).toHaveBeenCalledWith(1);
            expect(mockDeckModel.addCard).toHaveBeenCalledWith(1, 1, 1, 3, false, mockCard);
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Card added to deck successfully',
            });
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            mockRequest.params = { id: '1' };
            mockRequest.body = { card_id: 1 };
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail when card_id is missing', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { quantity: 1 };
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'card_id is required',
            }));
        });
        it('should fail when quantity is invalid', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { card_id: 1, quantity: 5 };
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'quantity must be between 1 and 3',
            }));
        });
        it('should fail when card not found', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { card_id: 999 };
            mockCardModel.findById.mockResolvedValue(null);
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Card not found',
            }));
        });
        it('should fail when deck validation fails', async () => {
            mockRequest.params = { id: '1' };
            mockRequest.body = { card_id: 1 };
            mockCardModel.findById.mockResolvedValue(mockCard);
            mockDeckModel.addCard.mockResolvedValue({
                success: false,
                error: 'Main Deck cannot exceed 60 cards',
            });
            await deckController_1.DeckController.addCardToDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Main Deck cannot exceed 60 cards',
            }));
        });
    });
    describe('removeCardFromDeck', () => {
        it('should remove card from deck successfully', async () => {
            mockRequest.params = { id: '1', cardId: '5' };
            mockDeckModel.removeCard.mockResolvedValue(true);
            await deckController_1.DeckController.removeCardFromDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.removeCard).toHaveBeenCalledWith(1, 1, 5);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Card removed from deck successfully',
            });
        });
        it('should fail when not authenticated', async () => {
            mockRequest.user = undefined;
            mockRequest.params = { id: '1', cardId: '5' };
            await deckController_1.DeckController.removeCardFromDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Not authenticated',
            }));
        });
        it('should fail when card not found in deck', async () => {
            mockRequest.params = { id: '1', cardId: '999' };
            mockDeckModel.removeCard.mockResolvedValue(false);
            await deckController_1.DeckController.removeCardFromDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Card not found in deck or you do not have permission',
            }));
        });
    });
    describe('updateCardQuantity', () => {
        it('should update card quantity successfully', async () => {
            mockRequest.params = { id: '1', cardId: '5' };
            mockRequest.body = { quantity: 2 };
            const deckWithCard = {
                ...mockDeck,
                main_deck: [{ id: 5, card: mockCard, quantity: 1, deck_id: 1, card_id: 1, is_extra_deck: false, created_at: new Date() }],
            };
            mockDeckModel.findById.mockResolvedValue(deckWithCard);
            mockDeckModel.updateCardQuantity.mockResolvedValue({ success: true });
            await deckController_1.DeckController.updateCardQuantity(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.updateCardQuantity).toHaveBeenCalledWith(1, 1, 5, 2, mockCard);
            expect(mockResponse.json).toHaveBeenCalledWith({
                message: 'Card quantity updated successfully',
            });
        });
        it('should fail when quantity is invalid', async () => {
            mockRequest.params = { id: '1', cardId: '5' };
            mockRequest.body = { quantity: 5 };
            await deckController_1.DeckController.updateCardQuantity(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'quantity must be between 0 and 3',
            }));
        });
        it('should fail when deck not found', async () => {
            mockRequest.params = { id: '999', cardId: '5' };
            mockRequest.body = { quantity: 2 };
            mockDeckModel.findById.mockResolvedValue(null);
            await deckController_1.DeckController.updateCardQuantity(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Deck not found',
            }));
        });
        it('should fail when card not found in deck', async () => {
            mockRequest.params = { id: '1', cardId: '999' };
            mockRequest.body = { quantity: 2 };
            mockDeckModel.findById.mockResolvedValue(mockDeck);
            await deckController_1.DeckController.updateCardQuantity(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Card not found in deck',
            }));
        });
    });
    describe('validateDeck', () => {
        it('should return valid deck validation', async () => {
            mockRequest.params = { id: '1' };
            mockDeckModel.validateDeck.mockResolvedValue({
                valid: true,
                errors: [],
                mainDeckCount: 40,
                extraDeckCount: 15,
            });
            await deckController_1.DeckController.validateDeck(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.validateDeck).toHaveBeenCalledWith(1);
            expect(mockResponse.json).toHaveBeenCalledWith({
                valid: true,
                errors: [],
                mainDeckCount: 40,
                extraDeckCount: 15,
            });
        });
        it('should return validation errors', async () => {
            mockRequest.params = { id: '1' };
            mockDeckModel.validateDeck.mockResolvedValue({
                valid: false,
                errors: ['Main Deck must have at least 40 cards'],
                mainDeckCount: 35,
                extraDeckCount: 10,
            });
            await deckController_1.DeckController.validateDeck(mockRequest, mockResponse, mockNext);
            expect(mockResponse.json).toHaveBeenCalledWith({
                valid: false,
                errors: ['Main Deck must have at least 40 cards'],
                mainDeckCount: 35,
                extraDeckCount: 10,
            });
        });
        it('should fail with invalid deck ID', async () => {
            mockRequest.params = { id: 'invalid' };
            await deckController_1.DeckController.validateDeck(mockRequest, mockResponse, mockNext);
            expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Invalid deck ID',
            }));
        });
    });
    describe('getPublicDecks', () => {
        it('should return paginated public decks', async () => {
            mockRequest.query = { page: '1', limit: '20' };
            const paginatedResponse = {
                data: [mockDeck],
                total: 1,
                page: 1,
                limit: 20,
                total_pages: 1,
            };
            mockDeckModel.searchPublicDecks.mockResolvedValue(paginatedResponse);
            await deckController_1.DeckController.getPublicDecks(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.searchPublicDecks).toHaveBeenCalled();
            expect(mockResponse.json).toHaveBeenCalledWith(paginatedResponse);
        });
        it('should apply filters', async () => {
            mockRequest.query = {
                search: 'Dragon',
                respect_banlist: 'true',
                user_id: '1',
            };
            mockDeckModel.searchPublicDecks.mockResolvedValue({
                data: [],
                total: 0,
                page: 1,
                limit: 20,
                total_pages: 0,
            });
            await deckController_1.DeckController.getPublicDecks(mockRequest, mockResponse, mockNext);
            expect(mockDeckModel.searchPublicDecks).toHaveBeenCalledWith(expect.objectContaining({
                search: 'Dragon',
                respect_banlist: true,
                user_id: 1,
            }), expect.any(Number));
        });
    });
});
