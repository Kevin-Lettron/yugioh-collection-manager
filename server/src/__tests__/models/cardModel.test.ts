/// <reference types="jest" />
/**
 * Unit tests for CardModel
 * Tests card CRUD and search operations with mocked database
 */

import { CardModel } from '../../models/cardModel';
import * as database from '../../config/database';

// Mock the database module
jest.mock('../../config/database', () => ({
  query: jest.fn(),
}));

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;

describe('CardModel', () => {
  // Mock card data
  const mockCard = {
    id: 1,
    card_id: '46986414',
    name: 'Dark Magician',
    type: 'Normal Monster',
    frame_type: 'normal',
    description: 'The ultimate wizard in terms of attack and defense.',
    atk: 2500,
    def: 2100,
    level: 7,
    race: 'Spellcaster',
    attribute: 'DARK',
    archetype: 'Dark Magician',
    card_sets: [
      { set_name: 'Legend of Blue Eyes', set_code: 'LOB-005', set_rarity: 'Ultra Rare', set_rarity_code: 'UR', set_price: '10.00' }
    ],
    card_images: [
      { id: 46986414, image_url: 'https://example.com/dark-magician.jpg', image_url_small: 'https://example.com/dark-magician-small.jpg' }
    ],
    card_prices: { tcgplayer_price: '5.00' },
    banlist_info: {},
    linkval: null,
    linkmarkers: [],
    scale: null,
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
    description: 'A Synchro Monster',
    atk: 2500,
    def: 2000,
    level: 8,
    race: 'Dragon',
    attribute: 'WIND',
    archetype: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('should create a new card successfully', async () => {
      const cardData = {
        card_id: '12345',
        name: 'Test Card',
        type: 'Effect Monster',
        frame_type: 'effect',
        description: 'A test card',
        atk: 1500,
        def: 1200,
        level: 4,
        race: 'Warrior',
        attribute: 'EARTH',
        archetype: undefined,
        card_sets: [],
        card_images: [],
        card_prices: {},
        banlist_info: {},
        linkval: undefined,
        linkmarkers: [],
        scale: undefined,
      };

      mockQuery.mockResolvedValue({
        rows: [{ ...cardData, id: 1, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.upsert(cardData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cards'),
        expect.arrayContaining([cardData.card_id, cardData.name])
      );
      expect(result.name).toBe('Test Card');
    });

    it('should update existing card on conflict', async () => {
      const cardData = {
        card_id: '46986414',
        name: 'Dark Magician Updated',
        type: 'Normal Monster',
        frame_type: 'normal',
        description: 'Updated description',
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
        linkval: undefined,
        linkmarkers: [],
        scale: undefined,
      };

      mockQuery.mockResolvedValue({
        rows: [{ ...cardData, id: 1, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.upsert(cardData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (card_id) DO UPDATE'),
        expect.any(Array)
      );
      expect(result.name).toBe('Dark Magician Updated');
    });

    it('should handle JSON serialization for complex fields', async () => {
      const cardData = {
        card_id: '12345',
        name: 'Test Card',
        type: 'Effect Monster',
        frame_type: 'effect',
        description: 'A test card',
        atk: 1500,
        def: 1200,
        level: 4,
        race: 'Warrior',
        attribute: 'EARTH',
        archetype: undefined,
        card_sets: [{ set_name: 'Test Set', set_code: 'TST-001', set_rarity: 'Common', set_rarity_code: 'C', set_price: '1.00' }],
        card_images: [{ id: 12345, image_url: 'http://test.com', image_url_small: 'http://test.com/small' }],
        card_prices: { tcgplayer_price: '2.50' },
        banlist_info: { ban_tcg: 'Limited' as const },
        linkval: undefined,
        linkmarkers: [],
        scale: undefined,
      };

      mockQuery.mockResolvedValue({
        rows: [{ ...cardData, id: 1, created_at: new Date(), updated_at: new Date() }],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: [],
      });

      await CardModel.upsert(cardData);

      // Verify JSON stringify was used for complex fields
      const callArgs = mockQuery.mock.calls[0][1] as any[];
      expect(callArgs[11]).toBe(JSON.stringify(cardData.card_sets));
      expect(callArgs[12]).toBe(JSON.stringify(cardData.card_images));
    });
  });

  describe('findById', () => {
    it('should return card when found by database ID', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findById(1);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [1]
      );
      expect(result).toBeDefined();
      expect(result?.name).toBe('Dark Magician');
    });

    it('should return null when card not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findById(9999);

      expect(result).toBeNull();
    });

    it('should properly parse card with all fields', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findById(1);

      expect(result?.card_sets).toEqual(mockCard.card_sets);
      expect(result?.card_images).toEqual(mockCard.card_images);
      expect(result?.banlist_info).toEqual({});
    });
  });

  describe('findByCardId', () => {
    it('should return card when found by YGOProDeck card_id', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findByCardId('46986414');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE card_id = $1'),
        ['46986414']
      );
      expect(result?.card_id).toBe('46986414');
    });

    it('should return null when card_id not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findByCardId('99999999');

      expect(result).toBeNull();
    });
  });

  describe('findByName', () => {
    it('should return card when found by name (case insensitive)', async () => {
      mockQuery.mockResolvedValue({
        rows: [mockCard],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findByName('dark magician');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['dark magician']
      );
      expect(result?.name).toBe('Dark Magician');
    });

    it('should return null when name not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findByName('NonExistent Card');

      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search cards by term', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: '2' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [mockCard, mockExtraDeckCard],
          rowCount: 2,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('Dragon');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(2);
      expect(result.cards).toHaveLength(2);
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { type: 'Normal Monster' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.arrayContaining(['Normal Monster'])
      );
      expect(result.cards).toHaveLength(1);
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
          rows: [mockExtraDeckCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { frame_type: 'synchro' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('frame_type = $'),
        expect.arrayContaining(['synchro'])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { level: 7 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('level = $'),
        expect.arrayContaining([7])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { attribute: 'DARK' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('attribute = $'),
        expect.arrayContaining(['DARK'])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { race: 'Spellcaster' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('race = $'),
        expect.arrayContaining(['Spellcaster'])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { min_atk: 2000, max_atk: 3000 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('atk >= $'),
        expect.arrayContaining([2000])
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('atk <= $'),
        expect.arrayContaining([3000])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', { min_def: 1500, max_def: 2500 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('def >= $'),
        expect.arrayContaining([1500])
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('def <= $'),
        expect.arrayContaining([2500])
      );
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
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('Magician', {
        type: 'Normal Monster',
        attribute: 'DARK',
        level: 7,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('type = $'),
        expect.any(Array)
      );
    });

    it('should paginate results with limit and offset', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: '100' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('', {}, 10, 20);

      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
      expect(result.total).toBe(100);
    });

    it('should return empty results when no matches', async () => {
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

      const result = await CardModel.search('xyznonexistent');

      expect(result.cards).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should handle empty search term', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ count: '1000' }],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        })
        .mockResolvedValueOnce({
          rows: [mockCard],
          rowCount: 1,
          command: 'SELECT',
          oid: 0,
          fields: [],
        });

      const result = await CardModel.search('');

      // Should not include search term condition
      expect(result.total).toBe(1000);
    });
  });

  describe('parseCard', () => {
    it('should handle null/undefined values for optional fields', async () => {
      const cardWithNulls = {
        ...mockCard,
        card_sets: null,
        card_images: null,
        card_prices: null,
        banlist_info: null,
        linkmarkers: null,
      };

      mockQuery.mockResolvedValue({
        rows: [cardWithNulls],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: [],
      });

      const result = await CardModel.findById(1);

      expect(result?.card_sets).toEqual([]);
      expect(result?.card_images).toEqual([]);
      expect(result?.card_prices).toEqual({});
      expect(result?.banlist_info).toEqual({});
      expect(result?.linkmarkers).toEqual([]);
    });
  });
});
