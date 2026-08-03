import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { DuelModel } from '../models/duelModel';
import { DeckModel } from '../models/deckModel';
import { Duel } from '../../../shared/types';
import { deckToEngine, checkEngineDeck } from '../services/duelEngine/deckLoader';
import {
  createEngineDuel,
  respondToEngine,
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
 * **À ce stade (étape 2 du plan), les messages sont renvoyés bruts.** Leur
 * traduction en événements exploitables par le front, et le filtrage de ce que
 * chaque joueur a le droit de voir, sont l'objet de l'étape 3. Ne pas brancher
 * l'interface dessus avant.
 */

/** Le challenger tient l'équipe 0, l'adversaire l'équipe 1. */
type Seat = 0 | 1;

function seatOf(duel: Duel, userId: number): Seat | null {
  if (duel.challenger_id === userId) return 0;
  if (duel.opponent_id === userId) return 1;
  return null;
}

async function loadParticipantDuel(req: AuthRequest): Promise<{ duel: Duel; seat: Seat }> {
  if (!req.user) throw new ValidationError('Not authenticated');

  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) throw new ValidationError('id invalide');

  const duel = await DuelModel.findById(id);
  if (!duel) throw new NotFoundError('Duel introuvable');

  const seat = seatOf(duel, req.user.id);
  if (seat === null) throw new ForbiddenError('Vous ne participez pas a ce duel');

  return { duel, seat };
}

export class DuelEngineController {
  /**
   * POST /duels/:id/engine/start — ouvre la partie dans le moteur.
   *
   * Idempotent au sens utile du terme : relancer sur un duel déjà ouvert
   * détruit l'instance précédente et repart d'un mélange neuf. C'est voulu tant
   * qu'on est en développement ; l'étape 4 le fermera.
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

      if (problems.length) {
        throw new ValidationError(problems.join(' · '));
      }

      const result = await createEngineDuel({
        duelId: duel.id,
        players: [conversions[0].deck, conversions[1].deck],
      });

      logger.info(
        `[DUEL_ENGINE] duel ${duel.id} ouvert — ${result.messages.length} messages, ` +
          `statut ${result.status}`
      );

      res.json({
        duel_id: duel.id,
        seat,
        status: result.status,
        steps: result.steps,
        // Bruts : voir l'avertissement en tête de fichier.
        messages: result.messages,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/engine/respond — transmet la décision du joueur au moteur.
   *
   * Passe-plat volontaire : le corps est une `OcgResponse` telle que le moteur
   * l'attend. C'est utilisable pour tester le pont de bout en bout, pas pour
   * brancher une interface — l'étape 3 mettra une vraie traduction devant, et
   * surtout la vérification que c'est bien au joueur qui répond de le faire.
   */
  static async respond(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);

      if (!isDuelLive(duel.id)) {
        throw new ValidationError("Ce duel n'est pas ouvert dans le moteur");
      }
      if (!req.body || typeof req.body !== 'object') {
        throw new ValidationError('Réponse absente');
      }

      const result = await respondToEngine(duel.id, req.body);

      res.json({
        duel_id: duel.id,
        status: result.status,
        steps: result.steps,
        messages: result.messages,
      });
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
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/engine/stats — santé du moteur.
   *
   * Réservé à l'administration : la consommation mémoire du worker est
   * l'indicateur qui décidera du dimensionnement du serveur.
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
