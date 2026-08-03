import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { DuelModel } from '../models/duelModel';
import { DeckModel } from '../models/deckModel';
import { Duel } from '../../../shared/types';
import type { DuelChoice, DuelSeat } from '../../../shared/duelView';
import { deckToEngine, checkEngineDeck } from '../services/duelEngine/deckLoader';
import {
  createEngineDuel,
  chooseInEngine,
  viewEngineDuel,
  destroyEngineDuel,
  engineStats,
  isDuelLive,
} from '../services/duelEngine/engineClient';
import { assetsInstalled } from '../services/duelEngine/paths';

/**
 * Duel joué par le moteur ygopro-core.
 *
 * Ce contrôleur coexiste avec `duelController` : le duel manuel reste le mode
 * par défaut, et le mode moteur s'active explicitement sur un duel déjà accepté.
 * Ils partagent la table `duels` pour le cycle de vie (défi, acceptation,
 * abandon) et rien d'autre — l'état de partie du mode moteur vit dans le worker,
 * pas dans `challenger_state` / `opponent_state`.
 *
 * Le front ne voit **jamais** une structure du moteur : il reçoit un plateau
 * déjà filtré de l'information cachée, et une invite dont les options portent
 * des identifiants opaques. Il renvoie ces identifiants, le serveur retraduit.
 * Un client ne peut donc ni répondre à la place de l'adversaire, ni désigner
 * une carte qu'on ne lui a pas proposée.
 */

/** Le challenger tient l'équipe 0, l'adversaire l'équipe 1. */
function seatOf(duel: Duel, userId: number): DuelSeat | null {
  if (duel.challenger_id === userId) return 0;
  if (duel.opponent_id === userId) return 1;
  return null;
}

async function loadParticipantDuel(req: AuthRequest): Promise<{ duel: Duel; seat: DuelSeat }> {
  if (!req.user) throw new ValidationError('Not authenticated');

  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new ValidationError('id invalide');

  const duel = await DuelModel.findById(id);
  if (!duel) throw new NotFoundError('Duel introuvable');

  const seat = seatOf(duel, req.user.id);
  if (seat === null) throw new ForbiddenError('Vous ne participez pas a ce duel');

  return { duel, seat };
}

/** Diffuse aux deux joueurs le fait que l'état a changé, sans leur envoyer la vue. */
function notifySeats(req: AuthRequest, duel: Duel): void {
  const io = req.app.get('io');
  if (!io) return;
  // Chacun doit redemander **sa** vue : envoyer l'état dans la room commune
  // révélerait la main de l'un à l'autre.
  io.to(`duel:${duel.id}`).emit('duel:engine_update', { duelId: duel.id });
}

export class DuelEngineController {
  /**
   * POST /duels/:id/engine/start — ouvre la partie dans le moteur.
   *
   * Relancer sur un duel déjà ouvert détruit l'instance précédente et repart
   * d'un mélange neuf. C'est volontaire tant qu'on développe ; l'étape 4 le
   * fermera.
   */
  static async start(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!assetsInstalled()) {
        throw new ValidationError(
          "Le moteur de duel n'est pas installé sur ce serveur (données manquantes)"
        );
      }

      const { duel, seat } = await loadParticipantDuel(req);

      if (duel.status !== 'active') {
        throw new ValidationError('Le duel doit être accepté avant de lancer le moteur');
      }
      if (!duel.challenger_deck_id || !duel.opponent_deck_id) {
        throw new ValidationError('Les deux joueurs doivent avoir choisi un deck');
      }

      const [challengerDeck, opponentDeck] = await Promise.all([
        DeckModel.findById(duel.challenger_deck_id),
        DeckModel.findById(duel.opponent_deck_id),
      ]);
      if (!challengerDeck || !opponentDeck) throw new NotFoundError('Deck introuvable');

      const conversions = [deckToEngine(challengerDeck), deckToEngine(opponentDeck)] as const;

      // On refuse **avant** de créer quoi que ce soit dans le moteur : un duel
      // à moitié monté serait plus pénible à nettoyer qu'à empêcher.
      const problems = conversions
        .map((c, i) => {
          const problem = checkEngineDeck(c);
          return problem ? `${i === 0 ? 'Challenger' : 'Adversaire'} : ${problem}` : null;
        })
        .filter((p): p is string => p !== null);

      if (problems.length) throw new ValidationError(problems.join(' · '));

      const state = await createEngineDuel({
        duelId: duel.id,
        seat,
        players: [conversions[0].deck, conversions[1].deck],
      });

      logger.info(`[DUEL_ENGINE] duel ${duel.id} ouvert (statut ${state.status})`);
      notifySeats(req, duel);

      res.json(state);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/:id/engine — l'état courant, du point de vue de l'appelant.
   *
   * Sans effet de bord : c'est ce qu'appelle un joueur qui recharge sa page, ou
   * celui qui attend que l'autre joue.
   */
  static async view(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel, seat } = await loadParticipantDuel(req);
      if (!isDuelLive(duel.id)) {
        throw new NotFoundError("Ce duel n'est pas ouvert dans le moteur");
      }
      res.json(await viewEngineDuel(duel.id, seat));
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/engine/choose — la décision du joueur.
   *
   * Corps attendu : `{ optionIds: string[], cancel?: boolean }`, où les
   * identifiants sont ceux de l'invite reçue. Le worker vérifie que la question
   * était bien posée à ce siège et que les options existent ; une option
   * inventée est rejetée avant d'atteindre le moteur.
   */
  static async choose(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel, seat } = await loadParticipantDuel(req);

      if (!isDuelLive(duel.id)) {
        throw new ValidationError("Ce duel n'est pas ouvert dans le moteur");
      }

      const body = req.body as Partial<DuelChoice> | undefined;
      const optionIds = Array.isArray(body?.optionIds) ? body!.optionIds : [];
      if (!optionIds.every((id) => typeof id === 'string' && id.length <= 64)) {
        throw new ValidationError('Choix mal formé');
      }
      if (optionIds.length === 0 && !body?.cancel) {
        throw new ValidationError('Aucune option choisie');
      }

      const state = await chooseInEngine(duel.id, seat, {
        optionIds,
        cancel: body?.cancel === true,
      });

      notifySeats(req, duel);
      res.json(state);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /duels/:id/engine — ferme l'instance et libère le tas du moteur.
   *
   * Le moteur n'a pas de ramasse-miettes : sans cet appel, un duel abandonné
   * occupe sa mémoire jusqu'au redémarrage du worker.
   */
  static async close(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);
      await destroyEngineDuel(duel.id);
      notifySeats(req, duel);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/engine/stats — santé du moteur, réservé à l'administration.
   */
  static async stats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      if (req.user.role !== 'admin') throw new ForbiddenError('Réservé aux administrateurs');
      if (!assetsInstalled()) {
        res.json({ installed: false });
        return;
      }
      res.json({ installed: true, ...(await engineStats()) });
    } catch (err) {
      next(err);
    }
  }
}
