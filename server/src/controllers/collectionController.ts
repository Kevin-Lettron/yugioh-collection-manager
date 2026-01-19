import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { UserCardModel } from '../models/userCardModel';
import { CardModel } from '../models/cardModel';
import { YGOProDeckService } from '../services/ygoprodeckService';

export class CollectionController {
  /**
   * Add card to collection by set code
   * Fetches from YGOProDeck API, upserts to cards table, then adds to user's collection
   */
  static async addCardByCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { set_code, rarity, quantity = 1 } = req.body;

      // Validate input
      if (!set_code || !rarity) {
        throw new ValidationError('set_code and rarity are required');
      }

      if (quantity < 1 || quantity > 100) {
        throw new ValidationError('quantity must be between 1 and 100');
      }

      // Fetch card from YGOProDeck API
      loggers.external.request('YGOProDeck', `/cardinfo.php?set=${set_code}`);
      const apiCard = await YGOProDeckService.getCardBySetCode(set_code);

      if (!apiCard) {
        throw new NotFoundError(`Card with set code '${set_code}' not found`);
      }

      // Verify the rarity is valid for this set code
      const validRarities = YGOProDeckService.getRaritiesForSetCode(apiCard, set_code);
      if (validRarities.length > 0 && !validRarities.includes(rarity)) {
        throw new ValidationError(
          `Invalid rarity '${rarity}' for set code '${set_code}'. Valid rarities: ${validRarities.join(', ')}`
        );
      }

      // Upsert card in database
      const card = await CardModel.upsert(apiCard);

      // Add to user's collection
      const userCard = await UserCardModel.addToCollection(
        req.user.id,
        card.id,
        set_code,
        rarity,
        quantity
      );

      loggers.collection.cardAdded(req.user.id, card.id, quantity);

      res.status(201).json({
        message: 'Card added to collection',
        card: userCard,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's collection with filters and pagination
   */
  static async getUserCollection(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const {
        page = 1,
        limit = 50,
        search,
        type,
        frame_type,
        rarity,
        level,
        min_atk,
        max_atk,
        min_def,
        max_def,
        attribute,
        race,
      } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        type: type as string,
        frame_type: frame_type as string,
        rarity: rarity as string,
        level: level ? parseInt(level as string) : undefined,
        min_atk: min_atk ? parseInt(min_atk as string) : undefined,
        max_atk: max_atk ? parseInt(max_atk as string) : undefined,
        min_def: min_def ? parseInt(min_def as string) : undefined,
        max_def: max_def ? parseInt(max_def as string) : undefined,
        attribute: attribute as string,
        race: race as string,
      };

      const result = await UserCardModel.getUserCollection(req.user.id, filters);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific card details from user's collection
   */
  static async getCardDetail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const cardId = parseInt(req.params.cardId);

      if (isNaN(cardId)) {
        throw new ValidationError('Invalid card ID');
      }

      const userCard = await UserCardModel.getUserCard(req.user.id, cardId);

      if (!userCard) {
        throw new NotFoundError('Card not found in collection');
      }

      res.json({ card: userCard });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove card from collection
   */
  static async removeCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const userCardId = parseInt(req.params.userCardId);

      if (isNaN(userCardId)) {
        throw new ValidationError('Invalid user card ID');
      }

      const removed = await UserCardModel.removeFromCollection(req.user.id, userCardId);

      if (!removed) {
        throw new NotFoundError('Card not found in collection');
      }

      loggers.collection.cardRemoved(req.user.id, userCardId);

      res.json({ message: 'Card removed from collection' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update card quantity in collection
   */
  static async updateQuantity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const userCardId = parseInt(req.params.userCardId);
      const { quantity } = req.body;

      if (isNaN(userCardId)) {
        throw new ValidationError('Invalid user card ID');
      }

      if (quantity === undefined || quantity < 0 || quantity > 100) {
        throw new ValidationError('quantity must be between 0 and 100');
      }

      const updatedCard = await UserCardModel.updateQuantity(req.user.id, userCardId, quantity);

      if (quantity === 0 || !updatedCard) {
        loggers.collection.cardRemoved(req.user.id, userCardId);
        res.json({ message: 'Card removed from collection' });
      } else {
        res.json({
          message: 'Card quantity updated',
          card: updatedCard,
        });
      }
    } catch (error) {
      next(error);
    }
  }
}
