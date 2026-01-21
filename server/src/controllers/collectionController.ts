import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { UserCardModel } from '../models/userCardModel';
import { CardModel } from '../models/cardModel';
import { YGOProDeckService } from '../services/ygoprodeckService';

export class CollectionController {
  /**
   * Search for a card by code (Card ID or Set Code)
   * Returns card info, available sets/rarities, and detected language
   */
  static async searchCard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { code } = req.query;

      if (!code || typeof code !== 'string') {
        throw new ValidationError('code parameter is required');
      }

      loggers.external.request('YGOProDeck', `/cardinfo.php?code=${code}`);
      const result = await YGOProDeckService.searchByCodeOrSetCode(code);

      if (!result.card) {
        const errorMessage = result.error ||
          `Carte avec le code '${code}' non trouvée. Essayez d'utiliser le Code Set (ex: SDP-F037) situé sous l'illustration de la carte.`;
        throw new NotFoundError(errorMessage);
      }

      res.json({
        card: result.card,
        matchedSet: result.setInfo,
        availableSets: result.card.card_sets || [],
        detectedLanguage: result.detectedLanguage,
        originalSetCode: result.originalSetCode,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add card to collection by set code or card ID
   * Fetches from YGOProDeck API, upserts to cards table, then adds to user's collection
   * Supports language detection from set code (e.g., LDK2-FRK40 -> French)
   */
  static async addCardByCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { card_code, set_code, rarity, quantity = 1, language } = req.body;

      // Validate input - now only set_code and rarity are required
      if (!set_code || !rarity) {
        throw new ValidationError('set_code and rarity are required');
      }

      if (quantity < 1 || quantity > 100) {
        throw new ValidationError('quantity must be between 1 and 100');
      }

      // Detect language from set code if not provided
      const cardLanguage = language || YGOProDeckService.detectLanguageFromSetCode(set_code);

      let apiCard: Awaited<ReturnType<typeof YGOProDeckService.getCardById>> | null = null;
      let searchError: string | undefined;

      // If card_code is provided, try to fetch by ID first
      if (card_code) {
        loggers.external.request('YGOProDeck', `/cardinfo.php?id=${card_code}`);
        apiCard = await YGOProDeckService.getCardById(card_code);
      }

      // If no card found by ID or no card_code provided, try by set_code
      if (!apiCard) {
        loggers.external.request('YGOProDeck', `/cardinfo.php?set=${set_code}`);
        const result = await YGOProDeckService.getCardBySetCode(set_code);
        apiCard = result.card;
        searchError = result.error;
      }

      if (!apiCard) {
        const errorMessage = searchError ||
          `Carte non trouvée. Essayez d'utiliser le Code Set (ex: SDP-F037) situé sous l'illustration de la carte.`;
        throw new NotFoundError(errorMessage);
      }

      // Normalize the set code for rarity validation (API only has English rarities)
      const normalizedSetCode = YGOProDeckService.normalizeSetCode(set_code);
      const validRarities = YGOProDeckService.getRaritiesForSetCode(apiCard, normalizedSetCode);
      if (validRarities.length > 0 && !validRarities.includes(rarity)) {
        throw new ValidationError(
          `Rareté '${rarity}' invalide pour le code '${set_code}'. Raretés valides : ${validRarities.join(', ')}`
        );
      }

      // Upsert card in database
      const card = await CardModel.upsert(apiCard);

      // Add to user's collection with original set code and detected language
      const userCard = await UserCardModel.addToCollection(
        req.user.id,
        card.id,
        set_code.toUpperCase(), // Keep original set code (e.g., LDK2-FRK40)
        rarity,
        quantity,
        cardLanguage
      );

      loggers.collection.cardAdded(req.user.id, card.id, quantity);

      res.status(201).json({
        message: 'Card added to collection',
        card: userCard,
        language: cardLanguage,
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

      const userCardId = parseInt(req.params.id);

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

      const userCardId = parseInt(req.params.id);
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
