import axios from 'axios';
import { Card } from '../../../shared/types';

const API_BASE_URL = process.env.YGOPRODECK_API_URL || 'https://db.ygoprodeck.com/api/v7';

interface YGOProDeckCard {
  id: number;
  name: string;
  type: string;
  frameType: string;
  desc: string;
  atk?: number;
  def?: number;
  level?: number;
  race: string;
  attribute?: string;
  archetype?: string;
  card_sets?: any[];
  card_images: any[];
  card_prices?: any;
  banlist_info?: any;
  linkval?: number;
  linkmarkers?: string[];
  scale?: number;
}

export class YGOProDeckService {
  /**
   * Fetch card by name or set code
   */
  static async getCardBySetCode(setCode: string): Promise<Card | null> {
    try {
      // YGOProDeck API doesn't support direct set code search
      // We need to extract the card name from set code or search by set
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: {
          misc: 'yes',
        },
      });

      if (response.data && response.data.data) {
        const cards: YGOProDeckCard[] = response.data.data;

        // Find card by set code
        const card = cards.find((c: YGOProDeckCard) => {
          if (c.card_sets) {
            return c.card_sets.some((set: any) =>
              set.set_code.toLowerCase() === setCode.toLowerCase()
            );
          }
          return false;
        });

        if (card) {
          return this.transformCard(card);
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching card by set code:', error);
      throw error;
    }
  }

  /**
   * Fetch card by name
   */
  static async getCardByName(name: string): Promise<Card | null> {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: {
          name: name,
          misc: 'yes',
        },
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        return this.transformCard(response.data.data[0]);
      }

      return null;
    } catch (error) {
      console.error('Error fetching card by name:', error);
      return null;
    }
  }

  /**
   * Fetch card by YGOProDeck ID
   */
  static async getCardById(id: string): Promise<Card | null> {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: {
          id: id,
          misc: 'yes',
        },
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        return this.transformCard(response.data.data[0]);
      }

      return null;
    } catch (error) {
      console.error('Error fetching card by ID:', error);
      return null;
    }
  }

  /**
   * Search cards by query
   */
  static async searchCards(query: string, limit: number = 20): Promise<Card[]> {
    try {
      const response = await axios.get(`${API_BASE_URL}/cardinfo.php`, {
        params: {
          fname: query,
          misc: 'yes',
        },
      });

      if (response.data && response.data.data) {
        return response.data.data
          .slice(0, limit)
          .map((card: YGOProDeckCard) => this.transformCard(card));
      }

      return [];
    } catch (error) {
      console.error('Error searching cards:', error);
      return [];
    }
  }

  /**
   * Get rarities available for a specific set code
   */
  static getRaritiesForSetCode(card: Card, setCode: string): string[] {
    if (!card.card_sets) return [];

    const sets = card.card_sets.filter(
      (set: any) => set.set_code.toLowerCase() === setCode.toLowerCase()
    );

    return sets.map((set: any) => set.set_rarity);
  }

  /**
   * Transform YGOProDeck API response to our Card type
   */
  private static transformCard(apiCard: YGOProDeckCard): Card {
    return {
      id: 0, // Will be set by database
      card_id: apiCard.id.toString(),
      name: apiCard.name,
      type: apiCard.type,
      frame_type: apiCard.frameType,
      description: apiCard.desc,
      atk: apiCard.atk,
      def: apiCard.def,
      level: apiCard.level,
      race: apiCard.race,
      attribute: apiCard.attribute,
      archetype: apiCard.archetype,
      card_sets: apiCard.card_sets?.map(set => ({
        set_name: set.set_name,
        set_code: set.set_code,
        set_rarity: set.set_rarity,
        set_rarity_code: set.set_rarity_code,
        set_price: set.set_price,
      })),
      card_images: apiCard.card_images?.map(img => ({
        id: img.id,
        image_url: img.image_url,
        image_url_small: img.image_url_small,
        image_url_cropped: img.image_url_cropped,
      })),
      card_prices: apiCard.card_prices,
      banlist_info: apiCard.banlist_info ? {
        ban_tcg: apiCard.banlist_info.ban_tcg,
        ban_ocg: apiCard.banlist_info.ban_ocg,
        ban_goat: apiCard.banlist_info.ban_goat,
      } : undefined,
      linkval: apiCard.linkval,
      linkmarkers: apiCard.linkmarkers,
      scale: apiCard.scale,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Check if a card is in extra deck based on frame type
   */
  static isExtraDeckCard(frameType: string): boolean {
    const extraDeckTypes = ['fusion', 'synchro', 'xyz', 'link'];
    return extraDeckTypes.includes(frameType.toLowerCase());
  }

  /**
   * Get banlist limit for a card (for TCG format)
   */
  static getBanlistLimit(card: Card): number {
    if (!card.banlist_info?.ban_tcg) {
      return 3; // No restriction
    }

    switch (card.banlist_info.ban_tcg) {
      case 'Banned':
        return 0;
      case 'Limited':
        return 1;
      case 'Semi-Limited':
        return 2;
      default:
        return 3;
    }
  }
}
