import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { DeckModel } from '../models/deckModel';
import { CardModel } from '../models/cardModel';

export class DeckController {
  /**
   * Create a new deck
   */
  static async createDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { name, respect_banlist = true, is_public = true, cover_image } = req.body;

      // Validate input
      if (!name || name.trim().length === 0) {
        throw new ValidationError('Deck name is required');
      }

      if (name.length > 100) {
        throw new ValidationError('Deck name cannot exceed 100 characters');
      }

      const deck = await DeckModel.create(
        req.user.id,
        name.trim(),
        respect_banlist,
        is_public,
        cover_image
      );

      loggers.deck.created(deck.id, req.user.id, deck.name);

      res.status(201).json({
        message: 'Deck created successfully',
        deck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's decks with filters
   */
  static async getUserDecks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const { page = 1, limit = 20, search, respect_banlist } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        respect_banlist: respect_banlist ? respect_banlist === 'true' : undefined,
      };

      const result = await DeckModel.getUserDecks(req.user.id, filters);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deck by ID with full details
   */
  static async getDeckById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deckId = parseInt(req.params.id);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const deck = await DeckModel.findById(deckId, req.user?.id);

      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Check if user can view this deck
      if (!deck.is_public && (!req.user || deck.user_id !== req.user.id)) {
        throw new ForbiddenError('You do not have permission to view this deck');
      }

      res.json({ deck });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update deck properties
   */
  static async updateDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.id);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const { name, respect_banlist, is_public, cover_image } = req.body;

      const updates: any = {};
      if (name !== undefined) {
        if (name.trim().length === 0) {
          throw new ValidationError('Deck name cannot be empty');
        }
        if (name.length > 100) {
          throw new ValidationError('Deck name cannot exceed 100 characters');
        }
        updates.name = name.trim();
      }
      if (respect_banlist !== undefined) updates.respect_banlist = respect_banlist;
      if (is_public !== undefined) updates.is_public = is_public;
      if (cover_image !== undefined) updates.cover_image = cover_image;

      const updatedDeck = await DeckModel.update(deckId, req.user.id, updates);

      if (!updatedDeck) {
        throw new NotFoundError('Deck not found or you do not have permission to update it');
      }

      loggers.deck.updated(deckId, req.user.id);

      res.json({
        message: 'Deck updated successfully',
        deck: updatedDeck,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete deck
   */
  static async deleteDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.id);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const deleted = await DeckModel.delete(deckId, req.user.id);

      if (!deleted) {
        throw new NotFoundError('Deck not found or you do not have permission to delete it');
      }

      loggers.deck.deleted(deckId, req.user.id);

      res.json({ message: 'Deck deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add card to deck
   */
  static async addCardToDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.id);
      const { card_id, quantity = 1, is_extra_deck = false } = req.body;

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      if (!card_id) {
        throw new ValidationError('card_id is required');
      }

      if (quantity < 1 || quantity > 3) {
        throw new ValidationError('quantity must be between 1 and 3');
      }

      // Get card details
      const card = await CardModel.findById(card_id);
      if (!card) {
        throw new NotFoundError('Card not found');
      }

      const result = await DeckModel.addCard(
        deckId,
        req.user.id,
        card_id,
        quantity,
        is_extra_deck,
        card
      );

      if (!result.success) {
        throw new ValidationError(result.error || 'Failed to add card to deck');
      }

      res.status(201).json({
        message: 'Card added to deck successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove card from deck
   */
  static async removeCardFromDeck(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.id);
      const deckCardId = parseInt(req.params.cardId);

      if (isNaN(deckId) || isNaN(deckCardId)) {
        throw new ValidationError('Invalid deck or card ID');
      }

      const removed = await DeckModel.removeCard(deckId, req.user.id, deckCardId);

      if (!removed) {
        throw new NotFoundError('Card not found in deck or you do not have permission');
      }

      res.json({ message: 'Card removed from deck successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update card quantity in deck
   */
  static async updateCardQuantity(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new ValidationError('Not authenticated');
      }

      const deckId = parseInt(req.params.id);
      const deckCardId = parseInt(req.params.cardId);
      const { quantity } = req.body;

      if (isNaN(deckId) || isNaN(deckCardId)) {
        throw new ValidationError('Invalid deck or card ID');
      }

      if (quantity === undefined || quantity < 0 || quantity > 3) {
        throw new ValidationError('quantity must be between 0 and 3');
      }

      // Get card details for validation
      const deck = await DeckModel.findById(deckId, req.user.id);
      if (!deck) {
        throw new NotFoundError('Deck not found');
      }

      // Find the card in the deck
      const allCards = [...(deck.main_deck || []), ...(deck.extra_deck || [])];
      const deckCard = allCards.find((dc) => dc.id === deckCardId);

      if (!deckCard) {
        throw new NotFoundError('Card not found in deck');
      }

      const result = await DeckModel.updateCardQuantity(
        deckId,
        req.user.id,
        deckCardId,
        quantity,
        deckCard.card
      );

      if (!result.success) {
        throw new ValidationError(result.error || 'Failed to update card quantity');
      }

      res.json({ message: 'Card quantity updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate deck (check if it meets Yu-Gi-Oh rules)
   */
  static async validateDeck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deckId = parseInt(req.params.id);

      if (isNaN(deckId)) {
        throw new ValidationError('Invalid deck ID');
      }

      const validation = await DeckModel.validateDeck(deckId);

      if (!validation.valid) {
        loggers.deck.validationError(deckId, validation.errors);
      }

      res.json({
        valid: validation.valid,
        errors: validation.errors,
        mainDeckCount: validation.mainDeckCount,
        extraDeckCount: validation.extraDeckCount,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get public decks (search)
   */
  static async getPublicDecks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, search, respect_banlist, user_id } = req.query;

      const filters = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        search: search as string,
        respect_banlist: respect_banlist ? respect_banlist === 'true' : undefined,
        user_id: user_id ? parseInt(user_id as string) : undefined,
      };

      // Get requesting user ID if authenticated
      const authReq = req as AuthRequest;
      const requestingUserId = authReq.user?.id;

      const result = await DeckModel.searchPublicDecks(filters, requestingUserId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}
