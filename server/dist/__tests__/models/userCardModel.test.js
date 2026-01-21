"use strict";
/// <reference types="jest" />
/**
 * Unit tests for UserCardModel
 * Tests collection management operations with mocked database
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
const userCardModel_1 = require("../../models/userCardModel");
const database = __importStar(require("../../config/database"));
// Mock the database module
jest.mock('../../config/database', () => ({
    query: jest.fn(),
}));
const mockQuery = database.query;
describe('UserCardModel', () => {
    // Mock data
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
        linkval: null,
        linkmarkers: [],
        scale: null,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
    };
    const mockUserCard = {
        id: 1,
        user_id: 1,
        card_id: 1,
        set_code: 'LOB-005',
        rarity: 'Ultra Rare',
        quantity: 2,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
    };
    const mockUserCardWithCardDetails = {
        ...mockUserCard,
        card_db_id: mockCard.id,
        card_id: mockCard.card_id,
        name: mockCard.name,
        type: mockCard.type,
        frame_type: mockCard.frame_type,
        description: mockCard.description,
        atk: mockCard.atk,
        def: mockCard.def,
        level: mockCard.level,
        race: mockCard.race,
        attribute: mockCard.attribute,
        archetype: mockCard.archetype,
        card_sets: mockCard.card_sets,
        card_images: mockCard.card_images,
        card_prices: mockCard.card_prices,
        banlist_info: mockCard.banlist_info,
        linkval: mockCard.linkval,
        linkmarkers: mockCard.linkmarkers,
        scale: mockCard.scale,
    };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('addToCollection', () => {
        it('should add a new card to collection', async () => {
            mockQuery.mockResolvedValue({
                rows: [mockUserCard],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.addToCollection(1, 1, 'LOB-005', 'Ultra Rare', 2);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO user_cards'), [1, 1, 'LOB-005', 'Ultra Rare', 2]);
            expect(result.quantity).toBe(2);
            expect(result.rarity).toBe('Ultra Rare');
        });
        it('should update quantity on conflict (upsert)', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ ...mockUserCard, quantity: 5 }],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.addToCollection(1, 1, 'LOB-005', 'Ultra Rare', 3);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT'), expect.any(Array));
            expect(result.quantity).toBe(5);
        });
        it('should default to quantity 1 when not specified', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ ...mockUserCard, quantity: 1 }],
                rowCount: 1,
                command: 'INSERT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.addToCollection(1, 1, 'LOB-005', 'Ultra Rare');
            expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [1, 1, 'LOB-005', 'Ultra Rare', 1]);
        });
        it('should throw error on database failure', async () => {
            mockQuery.mockRejectedValue(new Error('Database error'));
            await expect(userCardModel_1.UserCardModel.addToCollection(1, 1, 'LOB-005', 'Ultra Rare')).rejects.toThrow('Database error');
        });
    });
    describe('getUserCollection', () => {
        it('should return paginated collection', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '3' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [
                    mockUserCardWithCardDetails,
                    { ...mockUserCardWithCardDetails, id: 2 },
                    { ...mockUserCardWithCardDetails, id: 3 },
                ],
                rowCount: 3,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCollection(1, { page: 1, limit: 50 });
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
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { search: 'Dark Magician' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.arrayContaining(['%Dark Magician%']));
        });
        it('should apply type filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { type: 'Normal Monster' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('c.type = $'), expect.arrayContaining(['Normal Monster']));
        });
        it('should apply frame_type filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { frame_type: 'effect' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('frame_type = $'), expect.arrayContaining(['effect']));
        });
        it('should apply rarity filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { rarity: 'Ultra Rare' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('uc.rarity = $'), expect.arrayContaining(['Ultra Rare']));
        });
        it('should apply level filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { level: 7 });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('c.level = $'), expect.arrayContaining([7]));
        });
        it('should apply ATK range filters', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { min_atk: 2000, max_atk: 3000 });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('atk >= $'), expect.arrayContaining([2000]));
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('atk <= $'), expect.arrayContaining([3000]));
        });
        it('should apply DEF range filters', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { min_def: 1500, max_def: 2500 });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('def >= $'), expect.arrayContaining([1500]));
        });
        it('should apply attribute filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { attribute: 'DARK' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('attribute = $'), expect.arrayContaining(['DARK']));
        });
        it('should apply race filter', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, { race: 'Spellcaster' });
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('race = $'), expect.arrayContaining(['Spellcaster']));
        });
        it('should apply multiple filters together', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            await userCardModel_1.UserCardModel.getUserCollection(1, {
                type: 'Normal Monster',
                attribute: 'DARK',
                level: 7,
                rarity: 'Ultra Rare',
            });
            expect(mockQuery).toHaveBeenCalledTimes(2);
        });
        it('should return empty collection when user has no cards', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '0' }],
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
            const result = await userCardModel_1.UserCardModel.getUserCollection(1);
            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
        });
        it('should parse user card with nested card data', async () => {
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCollection(1);
            expect(result.data[0].card).toBeDefined();
            expect(result.data[0].card?.name).toBe('Dark Magician');
        });
    });
    describe('getUserCard', () => {
        it('should return user card with card details', async () => {
            mockQuery.mockResolvedValue({
                rows: [mockUserCardWithCardDetails],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCard(1, 1);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE uc.user_id = $1 AND uc.card_id = $2'), [1, 1]);
            expect(result?.card?.name).toBe('Dark Magician');
        });
        it('should return null when card not in collection', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCard(1, 999);
            expect(result).toBeNull();
        });
    });
    describe('hasCard', () => {
        it('should return true when user has card', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.hasCard(1, 1);
            expect(result).toBe(true);
        });
        it('should return false when user does not have card', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ count: '0' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.hasCard(1, 999);
            expect(result).toBe(false);
        });
    });
    describe('getTotalQuantity', () => {
        it('should return total quantity across all rarities', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ total: '5' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getTotalQuantity(1, 1);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SUM(quantity)'), [1, 1]);
            expect(result).toBe(5);
        });
        it('should return 0 when card not in collection', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ total: null }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getTotalQuantity(1, 999);
            expect(result).toBe(0);
        });
    });
    describe('updateQuantity', () => {
        it('should update quantity successfully', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ ...mockUserCard, quantity: 5 }],
                rowCount: 1,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.updateQuantity(1, 1, 5);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE user_cards'), [5, 1, 1]);
            expect(result?.quantity).toBe(5);
        });
        it('should delete card when quantity is 0', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.updateQuantity(1, 1, 0);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM user_cards'), [1, 1]);
            expect(result).toBeNull();
        });
        it('should delete card when quantity is negative', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.updateQuantity(1, 1, -1);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM user_cards'), expect.any(Array));
            expect(result).toBeNull();
        });
        it('should return null when card not found', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'UPDATE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.updateQuantity(1, 999, 5);
            expect(result).toBeNull();
        });
    });
    describe('removeFromCollection', () => {
        it('should remove card successfully', async () => {
            mockQuery.mockResolvedValue({
                rows: [{ id: 1 }],
                rowCount: 1,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.removeFromCollection(1, 1);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM user_cards'), [1, 1]);
            expect(result).toBe(true);
        });
        it('should return false when card not found', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.removeFromCollection(1, 999);
            expect(result).toBe(false);
        });
        it('should return false when user does not own the card', async () => {
            mockQuery.mockResolvedValue({
                rows: [],
                rowCount: 0,
                command: 'DELETE',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.removeFromCollection(999, 1);
            expect(result).toBe(false);
        });
    });
    describe('parseUserCard (via getUserCollection)', () => {
        it('should handle null card_sets', async () => {
            const cardWithNulls = {
                ...mockUserCardWithCardDetails,
                card_sets: null,
            };
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [cardWithNulls],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCollection(1);
            expect(result.data[0].card?.card_sets).toEqual([]);
        });
        it('should handle null card_images', async () => {
            const cardWithNulls = {
                ...mockUserCardWithCardDetails,
                card_images: null,
            };
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [cardWithNulls],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCollection(1);
            expect(result.data[0].card?.card_images).toEqual([]);
        });
        it('should handle null banlist_info', async () => {
            const cardWithNulls = {
                ...mockUserCardWithCardDetails,
                banlist_info: null,
            };
            mockQuery
                .mockResolvedValueOnce({
                rows: [{ count: '1' }],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            })
                .mockResolvedValueOnce({
                rows: [cardWithNulls],
                rowCount: 1,
                command: 'SELECT',
                oid: 0,
                fields: [],
            });
            const result = await userCardModel_1.UserCardModel.getUserCollection(1);
            expect(result.data[0].card?.banlist_info).toEqual({});
        });
    });
});
