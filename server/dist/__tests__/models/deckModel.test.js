"use strict";
/// <reference types="jest" />
/**
 * Unit tests for DeckModel
 * Tests deck CRUD operations, validation, and banlist enforcement
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
const deckModel_1 = require("../../models/deckModel");
const database = __importStar(require("../../config/database"));
const ygoprodeckService_1 = require("../../services/ygoprodeckService");
// Mock the database module
jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getClient: jest.fn(),
}));
// Mock YGOProDeckService
jest.mock('../../services/ygoprodeckService', () => ({
    YGOProDeckService: {
        isExtraDeckCard: jest.fn(),
        getBanlistLimit: jest.fn(),
    },
}));
const mockQuery = database.query;
const mockIsExtraDeckCard = ygoprodeckService_1.YGOProDeckService.isExtraDeckCard;
const mockGetBanlistLimit = ygoprodeckService_1.YGOProDeckService.getBanlistLimit;
describe('DeckModel', () => {
    // Mock data
    const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        profile_picture: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
    };
    const mockDeck = {
        id: 1,
        user_id: 1,
        name: 'My Test Deck',
        cover_image: null,
        is_public: true,
        respect_banlist: true,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        username: 'testuser',
        email: 'test@example.com',
        profile_picture: null,
        likes_count: '5',
        dislikes_count: '2',
        comments_count: '10',
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
    const mockExtraDeckCard = {
        ...mockCard,
        id: 2,
        card_id: '74677422',
        name: 'Stardust Dragon',
        type: 'Synchro Monster',
        frame_type: 'synchro',
        level: 8,
        race: 'Dragon',
        attribute: 'WIND',
    };
    const mockForbiddenCard = {
        ...mockCard,
        id: 3,
        card_id: '12345678',
        name: 'Pot of Greed',
        type: 'Spell Card',
        frame_type: 'spell',
        banlist_info: { ban_tcg: 'Banned' },
    };
    const mockLimitedCard = {
        ...mockCard,
        id: 4,
        card_id: '23456789',
        name: 'Monster Reborn',
        type: 'Spell Card',
        frame_type: 'spell',
        banlist_info: { ban_tcg: 'Limited' },
    };
    const mockSemiLimitedCard = {
        ...mockCard,
        id: 5,
        card_id: '34567890',
        name: 'Semi Limited Card',
        type: 'Spell Card',
        frame_type: 'spell',
        banlist_info: { ban_tcg: 'Semi-Limited' },
    };
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsExtraDeckCard.mockReturnValue(false);
        mockGetBanlistLimit.mockReturnValue(3);
    });
    describe('create', () => {
        it('should create a new deck successfully', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ ...mockDeck }],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.create(1, 'My Test Deck', true, true);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO decks'), [1, 'My Test Deck', true, true, null]);
            expect(result.name).toBe('My Test Deck');
            expect(result.user_id).toBe(1);
        });
        it('should create deck with custom settings', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ ...mockDeck, respect_banlist: false, is_public: false }],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.create(1, 'Private Deck', false, false, 'http://cover.jpg');
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO decks'), [1, 'Private Deck', false, false, 'http://cover.jpg']);
        });
        it('should throw error on database failure', async () => {
            mockQuery.mockRejectedValue(new Error('Database error'));
            await expect(deckModel_1.DeckModel.create(1, 'Test Deck')).rejects.toThrow('Database error');
        });
    });
    describe('findById', () => {
        it('should return deck with full details when found', async () => {
            // First query for deck details
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                // Second query for deck cards
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.findById(1);
            expect(result).toBeDefined();
            expect(result?.name).toBe('My Test Deck');
            expect(result?.user).toBeDefined();
            expect(result?.main_deck).toEqual([]);
            expect(result?.extra_deck).toEqual([]);
        });
        it('should return null when deck not found', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.findById(9999);
            expect(result).toBeNull();
        });
        it('should include user reaction when requestingUserId provided', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                // Reaction query
                .mockResolvedValueOnce({
                rows: [{ is_like: true }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                // Wishlist query
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.findById(1, 2);
            expect(result?.user_reaction).toBe('like');
        });
    });
    describe('getUserDecks', () => {
        it('should return paginated user decks', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '3' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockDeck, { ...mockDeck, id: 2, name: 'Deck 2' }, { ...mockDeck, id: 3, name: 'Deck 3' }],
                rowCount: 3,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.getUserDecks(1, { page: 1, limit: 20 });
            expect(result.data).toHaveLength(3);
            expect(result.total).toBe(3);
            expect(result.page).toBe(1);
            expect(result.total_pages).toBe(1);
        });
        it('should apply search filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await deckModel_1.DeckModel.getUserDecks(1, { search: 'Test' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.arrayContaining(['%Test%']));
        });
        it('should filter by respect_banlist', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await deckModel_1.DeckModel.getUserDecks(1, { respect_banlist: true });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('respect_banlist'), expect.arrayContaining([true]));
        });
    });
    describe('update', () => {
        it('should update deck name', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, name: 'Updated Name' }],
                rowCount: 1,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, name: 'Updated Name' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.update(1, 1, { name: 'Updated Name' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE decks'), expect.arrayContaining(['Updated Name', 1, 1]));
        });
        it('should update multiple fields', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, is_public: false, respect_banlist: false }],
                rowCount: 1,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, is_public: false, respect_banlist: false }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await deckModel_1.DeckModel.update(1, 1, {
                is_public: false,
                respect_banlist: false,
            });
            expect(mockQuery).toHaveBeenCalledTimes(3);
        });
        it('should return null when deck not found or unauthorized', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.update(999, 1, { name: 'Test' });
            expect(result).toBeNull();
        });
    });
    describe('delete', () => {
        it('should delete deck successfully', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ id: 1 }],
                rowCount: 1,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.delete(1, 1);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM decks'), [1, 1]);
            expect(result).toBe(true);
        });
        it('should return false when deck not found or unauthorized', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.delete(999, 1);
            expect(result).toBe(false);
        });
    });
    describe('addCard', () => {
        beforeEach(() => {
            // Default mock for findById used in addCard
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
        });
        it('should add card to main deck successfully', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            mockGetBanlistLimit.mockReturnValue(3);
            // Count query
            mockQuery.mockResolvedValueOnce({
                rows: [{ main_count: '39', extra_count: '0', card_copies: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            // Insert card
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1 }],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            // Update timestamp
            mockQuery.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 1, 1, false, mockCard);
            expect(result.success).toBe(true);
        });
        it('should reject adding main deck card to extra deck', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            const result = await deckModel_1.DeckModel.addCard(1, 1, 1, 1, true, mockCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Cannot add non-Extra Deck monsters to Extra Deck');
        });
        it('should reject adding extra deck card to main deck', async () => {
            mockIsExtraDeckCard.mockReturnValue(true);
            const result = await deckModel_1.DeckModel.addCard(1, 1, 2, 1, false, mockExtraDeckCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Extra Deck monsters must be added to Extra Deck');
        });
        it('should reject when main deck exceeds 60 cards', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            // Reset mocks for this specific test
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '60', extra_count: '0', card_copies: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 1, 1, false, mockCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Main Deck cannot exceed 60 cards');
        });
        it('should reject when extra deck exceeds 15 cards', async () => {
            mockIsExtraDeckCard.mockReturnValue(true);
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '40', extra_count: '15', card_copies: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 2, 1, true, mockExtraDeckCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Extra Deck cannot exceed 15 cards');
        });
        it('should reject when card copies exceed 3 (no banlist)', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            mockGetBanlistLimit.mockReturnValue(3);
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, respect_banlist: false }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '40', extra_count: '0', card_copies: '3' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 1, 1, false, mockCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Maximum 3 copies');
        });
        it('should reject Forbidden card when respecting banlist', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            mockGetBanlistLimit.mockReturnValue(0);
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '40', extra_count: '0', card_copies: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 3, 1, false, mockForbiddenCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Forbidden');
        });
        it('should reject more than 1 Limited card when respecting banlist', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            mockGetBanlistLimit.mockReturnValue(1);
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '40', extra_count: '0', card_copies: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 4, 1, false, mockLimitedCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Banlist allows only 1 copy');
        });
        it('should reject more than 2 Semi-Limited cards when respecting banlist', async () => {
            mockIsExtraDeckCard.mockReturnValue(false);
            mockGetBanlistLimit.mockReturnValue(2);
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ main_count: '40', extra_count: '0', card_copies: '2' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 5, 1, false, mockSemiLimitedCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Banlist allows only 2 copies');
        });
        it('should return error for unauthorized deck access', async () => {
            jest.clearAllMocks();
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ ...mockDeck, user_id: 999 }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.addCard(1, 1, 1, 1, false, mockCard);
            expect(result.success).toBe(false);
            expect(result.error).toContain('unauthorized');
        });
    });
    describe('removeCard', () => {
        it('should remove card from deck successfully', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [{ id: 1 }],
                rowCount: 1,
                command: 'DELETE',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.removeCard(1, 1, 1);
            expect(result).toBe(true);
        });
        it('should return false when card not found', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.removeCard(1, 1, 999);
            expect(result).toBe(false);
        });
    });
    describe('validateDeck', () => {
        it('should validate deck with correct card counts', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '40', extra_count: '15' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.mainDeckCount).toBe(40);
            expect(result.extraDeckCount).toBe(15);
        });
        it('should return error when main deck has less than 40 cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '35', extra_count: '10' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Main Deck must have at least 40 cards');
            expect(result.mainDeckCount).toBe(35);
        });
        it('should return error when main deck exceeds 60 cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '65', extra_count: '10' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Main Deck cannot exceed 60 cards');
        });
        it('should return error when extra deck exceeds 15 cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '40', extra_count: '20' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Extra Deck cannot exceed 15 cards');
        });
        it('should return multiple errors', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '30', extra_count: '20' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors).toContain('Main Deck must have at least 40 cards');
            expect(result.errors).toContain('Extra Deck cannot exceed 15 cards');
        });
        it('should validate deck with exactly 40 main deck cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '40', extra_count: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(true);
            expect(result.mainDeckCount).toBe(40);
        });
        it('should validate deck with exactly 60 main deck cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '60', extra_count: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(true);
            expect(result.mainDeckCount).toBe(60);
        });
        it('should validate deck with exactly 15 extra deck cards', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ main_count: '40', extra_count: '15' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.validateDeck(1);
            expect(result.valid).toBe(true);
            expect(result.extraDeckCount).toBe(15);
        });
    });
    describe('searchPublicDecks', () => {
        it('should return only public decks', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '2' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [
                    { ...mockDeck, is_public: true },
                    { ...mockDeck, id: 2, is_public: true },
                ],
                rowCount: 2,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await deckModel_1.DeckModel.searchPublicDecks({});
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('is_public = true'), expect.any(Array));
            expect(result.data).toHaveLength(2);
        });
        it('should filter by user_id', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockDeck],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await deckModel_1.DeckModel.searchPublicDecks({ user_id: 1 });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('user_id'), expect.arrayContaining([1]));
        });
    });
});
