"use strict";
/// <reference types="jest" />
/**
 * Integration test for Mausoleum of White card
 * Card ID: 24382602
 * Type: Field Spell Card
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
const cardModel_1 = require("../../models/cardModel");
const userCardModel_1 = require("../../models/userCardModel");
const database = __importStar(require("../../config/database"));
// Mock the database
jest.mock('../../config/database', () => ({
    query: jest.fn(),
    pool: {
        connect: jest.fn(),
    },
}));
const mockQuery = database.query;
describe('Mausoleum of White Card Integration', () => {
    const mausoleumWhiteData = {
        id: 24382602,
        name: 'Mausoleum of White',
        type: 'Spell Card',
        frame_type: 'spell',
        desc: 'Once per turn, you can Normal Summon 1 Level 1 LIGHT Tuner monster in addition to your Normal Summon/Set. (You can only gain this effect once per turn.) Once per turn: You can target 1 face-up monster you control; send 1 Normal Monster from your hand or Deck to the GY, and if you do, that monster gains ATK/DEF equal to the Level of the sent monster x 100, until the end of this turn. If this card is in the GY: You can banish this card from your GY; add 1 "Burst Stream of Destruction" from your Deck to your hand.',
        race: 'Field',
        card_images: [{ image_url: 'https://images.ygoprodeck.com/images/cards/24382602.jpg' }],
        card_sets: [
            { set_name: 'Shining Victories', set_code: 'SHVI-EN059', set_rarity: 'Common' },
            { set_name: 'Legendary Duelists: White Dragon Abyss', set_code: 'LED3-EN012', set_rarity: 'Common' },
        ],
    };
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('CardModel - Card lookup and storage', () => {
        it('should find Mausoleum of White by card ID', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        card_id: 24382602,
                        name: 'Mausoleum of White',
                        type: 'Spell Card',
                        frame_type: 'spell',
                        desc: mausoleumWhiteData.desc,
                        race: 'Field',
                        image_url: 'https://images.ygoprodeck.com/images/cards/24382602.jpg',
                    }],
                rowCount: 1,
            });
            const card = await cardModel_1.CardModel.findByCardId('24382602');
            expect(card).not.toBeNull();
            expect(card?.name).toBe('Mausoleum of White');
            expect(card?.card_id).toBe(24382602);
            expect(card?.type).toBe('Spell Card');
            expect(card?.frame_type).toBe('spell');
            expect(card?.race).toBe('Field');
        });
        it('should find Mausoleum of White by name search', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        card_id: 24382602,
                        name: 'Mausoleum of White',
                        type: 'Spell Card',
                        frame_type: 'spell',
                        desc: mausoleumWhiteData.desc,
                        race: 'Field',
                        image_url: 'https://images.ygoprodeck.com/images/cards/24382602.jpg',
                    }],
                rowCount: 1,
            });
            const card = await cardModel_1.CardModel.findByName('Mausoleum of White');
            expect(card).not.toBeNull();
            expect(card?.name).toBe('Mausoleum of White');
        });
        it('should correctly identify as a Spell Card (not monster)', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        card_id: 24382602,
                        name: 'Mausoleum of White',
                        type: 'Spell Card',
                        frame_type: 'spell',
                        race: 'Field',
                    }],
                rowCount: 1,
            });
            const card = await cardModel_1.CardModel.findByCardId('24382602');
            expect(card?.frame_type).toBe('spell');
            expect(card?.type).toBe('Spell Card');
            // Should NOT be an Extra Deck card
            expect(['fusion', 'synchro', 'xyz', 'link']).not.toContain(card?.frame_type);
        });
        it('should upsert Mausoleum of White card data', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        card_id: 24382602,
                        name: 'Mausoleum of White',
                    }],
                rowCount: 1,
            });
            const result = await cardModel_1.CardModel.upsert({
                card_id: 24382602,
                name: 'Mausoleum of White',
                type: 'Spell Card',
                frame_type: 'spell',
                desc: mausoleumWhiteData.desc,
                race: 'Field',
                image_url: 'https://images.ygoprodeck.com/images/cards/24382602.jpg',
            });
            expect(result).not.toBeNull();
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO cards'), expect.arrayContaining([24382602, 'Mausoleum of White']));
        });
        it('should search for "Mausoleum" and find the card', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        card_id: 24382602,
                        name: 'Mausoleum of White',
                        type: 'Spell Card',
                        frame_type: 'spell',
                        race: 'Field',
                    }],
                rowCount: 1,
            });
            const results = await cardModel_1.CardModel.search({ search: 'Mausoleum' });
            expect(results.data.length).toBeGreaterThan(0);
            expect(results.data[0].name).toContain('Mausoleum');
        });
    });
    describe('UserCardModel - Collection management', () => {
        const userId = 1;
        const cardDbId = 1; // Internal DB ID
        it('should add Mausoleum of White to user collection', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        user_id: userId,
                        card_id: cardDbId,
                        quantity: 3,
                        set_code: 'SHVI-EN059',
                        rarity: 'Common',
                    }],
                rowCount: 1,
            });
            const result = await userCardModel_1.UserCardModel.addToCollection(userId, cardDbId, {
                quantity: 3,
                set_code: 'SHVI-EN059',
                rarity: 'Common',
            });
            expect(result).not.toBeNull();
            expect(result?.quantity).toBe(3);
            expect(result?.set_code).toBe('SHVI-EN059');
            expect(result?.rarity).toBe('Common');
        });
        it('should update quantity of Mausoleum of White in collection', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        user_id: userId,
                        card_id: cardDbId,
                        quantity: 2,
                    }],
                rowCount: 1,
            });
            const result = await userCardModel_1.UserCardModel.updateQuantity(userId, 1, 2);
            expect(result?.quantity).toBe(2);
        });
        it('should check if user has Mausoleum of White in collection', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ exists: true }],
                rowCount: 1,
            });
            const hasCard = await userCardModel_1.UserCardModel.hasCard(userId, cardDbId);
            expect(hasCard).toBe(true);
        });
        it('should get total quantity of Mausoleum of White for user', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ total: '3' }],
                rowCount: 1,
            });
            const total = await userCardModel_1.UserCardModel.getTotalQuantity(userId, cardDbId);
            expect(total).toBe(3);
        });
        it('should retrieve Mausoleum of White in user collection list', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        user_id: userId,
                        card_id: cardDbId,
                        quantity: 3,
                        set_code: 'SHVI-EN059',
                        rarity: 'Common',
                        card_name: 'Mausoleum of White',
                        card_type: 'Spell Card',
                        card_frame_type: 'spell',
                        card_image_url: 'https://images.ygoprodeck.com/images/cards/24382602.jpg',
                    }],
                rowCount: 1,
            });
            const collection = await userCardModel_1.UserCardModel.getUserCollection(userId);
            expect(collection.data.length).toBe(1);
            expect(collection.data[0].quantity).toBe(3);
        });
        it('should filter collection by Spell Card type', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 })
                .mockResolvedValueOnce({
                rows: [{
                        id: 1,
                        user_id: userId,
                        card_id: cardDbId,
                        quantity: 3,
                        card_name: 'Mausoleum of White',
                        card_type: 'Spell Card',
                        card_frame_type: 'spell',
                    }],
                rowCount: 1,
            });
            const collection = await userCardModel_1.UserCardModel.getUserCollection(userId, {
                type: 'Spell Card',
            });
            expect(collection.data.length).toBe(1);
            expect(collection.data[0].card?.type).toBe('Spell Card');
        });
        it('should remove Mausoleum of White from collection', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 1 }],
                rowCount: 1,
            });
            const removed = await userCardModel_1.UserCardModel.removeFromCollection(userId, 1);
            expect(removed).toBe(true);
        });
    });
    describe('Card Info Validation', () => {
        it('should have correct card ID (24382602)', () => {
            expect(mausoleumWhiteData.id).toBe(24382602);
        });
        it('should have correct name', () => {
            expect(mausoleumWhiteData.name).toBe('Mausoleum of White');
        });
        it('should be a Spell Card', () => {
            expect(mausoleumWhiteData.type).toBe('Spell Card');
        });
        it('should be a Field Spell', () => {
            expect(mausoleumWhiteData.race).toBe('Field');
        });
        it('should have image URL', () => {
            expect(mausoleumWhiteData.card_images[0].image_url).toBe('https://images.ygoprodeck.com/images/cards/24382602.jpg');
        });
        it('should have correct sets including SHVI-EN059', () => {
            const setCodes = mausoleumWhiteData.card_sets.map(s => s.set_code);
            expect(setCodes).toContain('SHVI-EN059');
        });
        it('should have correct sets including LED3-EN012', () => {
            const setCodes = mausoleumWhiteData.card_sets.map(s => s.set_code);
            expect(setCodes).toContain('LED3-EN012');
        });
        it('should mention Blue-Eyes related effects in description', () => {
            expect(mausoleumWhiteData.desc).toContain('Burst Stream of Destruction');
            expect(mausoleumWhiteData.desc).toContain('Level 1 LIGHT Tuner');
        });
    });
});
