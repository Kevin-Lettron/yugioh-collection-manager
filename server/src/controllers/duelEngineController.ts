import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { DuelModel } from '../models/duelModel';
import { DeckModel } from '../models/deckModel';
import { Duel } from '../../../shared/types';
import type { DuelChoice, DuelSeat, DuelPreGameState } from '../../../shared/duelView';
import { DuelEngineModel } from '../models/duelEngineModel';
import { DuelPreGameModel } from '../models/duelPreGameModel';
import { DuelClockModel } from '../models/duelClockModel';
import { deckToEngine, checkEngineDeck, buildEngineDeckFromIds } from '../services/duelEngine/deckLoader';
import { DuelMatchModel } from '../models/duelMatchModel';
import { DuelSideDeckModel } from '../models/duelSideDeckModel';
import type { DuelSeat as DuelSeatT } from '../../../shared/duelView';
import {
  createEngineDuel,
  chooseInEngine,
  viewEngineDuel,
  destroyEngineDuel,
  engineStats,
  isDuelLive,
  announceCardSearch,
  spectateEngineDuel,
} from '../services/duelEngine/engineClient';
import { FollowModel } from '../models/followModel';
import { assetsInstalled } from '../services/duelEngine/paths';

/**
 * Duel joué par le moteur ygopro-core.
 *
 * Convention de siège **postérieure au pile ou face** :
 *   - `seat 0` = le joueur qui joue en premier
 *   - `seat 1` = le second
 * Elle remplace l'ancienne convention siège = challenger, désormais impossible :
 * si le vainqueur du pile ou face choisit P2, c'est l'adversaire qui commence,
 * et c'est LUI qui doit être team 1 dans le moteur. Cette convention nous
 * évite d'ajouter une couche de traduction dans le worker : le moteur voit
 * simplement « player 0 = team 1 » comme d'habitude.
 *
 * Le duel manuel, lui, continue de raisonner en `sideOf` (challenger/opponent)
 * — les deux vocabulaires cohabitent sans se croiser.
 */

/**
 * Traduit un user_id en siège moteur.
 *
 * Si `first_player_id` est posé (pile ou face résolu), c'est lui qui commande.
 * Sinon (duel legacy sans coin flip) on retombe sur challenger=0.
 */
function seatOf(duel: Duel, userId: number): DuelSeat | null {
  const first = duel.first_player_id;
  if (first) {
    if (userId === first) return 0;
    if (userId === duel.challenger_id || userId === duel.opponent_id) return 1;
    return null;
  }
  if (duel.challenger_id === userId) return 0;
  if (duel.opponent_id === userId) return 1;
  return null;
}

/** Inverse de `seatOf` — sert au moment de traduire un vainqueur moteur en user_id. */
function userIdOfSeat(duel: Duel, seat: DuelSeat): number {
  if (duel.first_player_id) {
    const first = duel.first_player_id;
    const other = first === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
    return seat === 0 ? first : other;
  }
  return seat === 0 ? duel.challenger_id : duel.opponent_id;
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

/** Diffuse le nouveau pré-game state — payload complet, aucune info cachée. */
function notifyPreGame(req: AuthRequest, duel: Duel, state: DuelPreGameState): void {
  const io = req.app.get('io');
  if (!io) return;
  io.to(`duel:${duel.id}`).emit('duel:pregame', { duelId: duel.id, state });
}

export class DuelEngineController {
  /**
   * POST /duels/:id/engine/start — ouvre la partie dans le moteur.
   *
   * Trois cas :
   *   1. Aucune phase pré-game commencée → on la démarre (`awaiting_flip`) et
   *      on renvoie l'état correspondant. Le moteur **n'est pas** créé tant
   *      que le pile ou face n'a pas été résolu.
   *   2. Pré-game en cours → on renvoie l'état, sans effet de bord.
   *   3. Pré-game résolu → on crée l'instance moteur pour de bon.
   */
  static async start(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!assetsInstalled()) {
        throw new ValidationError(
          "Le moteur de duel n'est pas installé sur ce serveur (données manquantes)"
        );
      }

      const { duel } = await loadParticipantDuel(req);

      if (duel.status === 'finished' || duel.status === 'cancelled') {
        throw new ValidationError('Ce duel est terminé');
      }
      if (!duel.challenger_deck_id || !duel.opponent_deck_id) {
        throw new ValidationError('Les deux joueurs doivent avoir choisi un deck');
      }

      // ── Cas 1 : rien n'a été fait, on entre en pile ou face.
      if (duel.status === 'active' && !duel.phase_pre_game) {
        await DuelPreGameModel.begin(duel.id);
        const refreshed = (await DuelModel.findById(duel.id))!;
        const state = DuelPreGameModel.snapshot(refreshed);
        notifyPreGame(req, refreshed, state);
        res.status(202).json({ preGame: state });
        return;
      }

      // ── Cas 2 : pré-game commencé mais pas résolu.
      if (duel.status === 'pre_game') {
        // Résout automatiquement le choix si la deadline est passée — sans
        // cela, un vainqueur silencieux bloquerait la partie 30 min.
        await DuelPreGameModel.resolveChoiceIfExpired(duel);
        const refreshed = (await DuelModel.findById(duel.id))!;
        if (refreshed.phase_pre_game !== 'resolved') {
          res.status(202).json({ preGame: DuelPreGameModel.snapshot(refreshed) });
          return;
        }
      }

      // ── Cas 3 : pré-game résolu (ou legacy sans pré-game). On lance le moteur.
      const currentDuel = (await DuelModel.findById(duel.id))!;

      // F4 · Match Bo3 — quand la manche est ≥ 2, on repart des soumissions de
      // side-deck plutôt que du deck d'origine. Sans ça, le sideboard n'aurait
      // aucun effet.
      let conversions: readonly [
        { deck: { main: number[]; extra: number[] }; rejected: any[] },
        { deck: { main: number[]; extra: number[] }; rejected: any[] },
      ];
      if (currentDuel.match_id && (currentDuel.game_number ?? 1) >= 2) {
        const gameNumber = (currentDuel.game_number ?? 2) as 2 | 3;
        const [challengerSub, opponentSub] = await Promise.all([
          DuelSideDeckModel.findForUser(currentDuel.match_id, currentDuel.challenger_id, gameNumber),
          DuelSideDeckModel.findForUser(currentDuel.match_id, currentDuel.opponent_id, gameNumber),
        ]);
        if (!challengerSub || !opponentSub) {
          throw new ValidationError('Les deux joueurs doivent avoir soumis leur side deck');
        }
        conversions = [
          await buildEngineDeckFromIds(challengerSub.main_cards, challengerSub.extra_cards),
          await buildEngineDeckFromIds(opponentSub.main_cards, opponentSub.extra_cards),
        ];
      } else {
        const [challengerDeck, opponentDeck] = await Promise.all([
          DeckModel.findById(currentDuel.challenger_deck_id!),
          DeckModel.findById(currentDuel.opponent_deck_id!),
        ]);
        if (!challengerDeck || !opponentDeck) throw new NotFoundError('Deck introuvable');
        conversions = [deckToEngine(challengerDeck), deckToEngine(opponentDeck)];
      }

      const problems = conversions
        .map((c, i) => {
          const problem = checkEngineDeck(c as any);
          return problem ? `${i === 0 ? 'Challenger' : 'Adversaire'} : ${problem}` : null;
        })
        .filter((p): p is string => p !== null);

      if (problems.length) throw new ValidationError(problems.join(' · '));

      // Ordonne les decks pour que players[0] = seat 0 = premier joueur.
      const challengerIsFirst =
        !currentDuel.first_player_id || currentDuel.first_player_id === currentDuel.challenger_id;
      const orderedPlayers: [
        (typeof conversions)[number]['deck'],
        (typeof conversions)[number]['deck'],
      ] = challengerIsFirst
        ? [conversions[0].deck, conversions[1].deck]
        : [conversions[1].deck, conversions[0].deck];

      // Bascule en `active` juste avant de créer, sans effacer les infos
      // pile ou face — elles servent à `seatOf` pour toute la partie.
      await DuelModel.setActiveAfterPreGame(currentDuel.id);

      const requesterSeat = seatOf(currentDuel, req.user!.id)!;
      const { state, seed } = await createEngineDuel({
        duelId: currentDuel.id,
        seat: requesterSeat,
        players: orderedPlayers,
      });

      await DuelEngineModel.markEngineDuel(currentDuel.id, seed);

      // Démarre le chrono pour le premier joueur.
      const firstPlayerUserId = userIdOfSeat(currentDuel, 0);
      await DuelClockModel.startFor(currentDuel.id, firstPlayerUserId);

      logger.info(`[DUEL_ENGINE] duel ${currentDuel.id} ouvert (statut ${state.status})`);
      notifySeats(req, currentDuel);

      const withClocks = await attachClocks(currentDuel.id, requesterSeat, state);
      res.json(withClocks);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/coin-flip — un joueur clique « lancer la pièce ».
   *
   * Le second clic déclenche le tirage côté serveur. Aucune valeur côté client
   * ne fait autorité — sinon un joueur mal intentionné pourrait s'auto-déclarer
   * gagnant.
   */
  static async coinFlip(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);
      if (duel.status !== 'pre_game') {
        throw new ValidationError("Le pile ou face n'est pas ouvert pour ce duel");
      }
      const state = await DuelPreGameModel.recordFlipClick(duel, req.user!.id);
      const refreshed = (await DuelModel.findById(duel.id))!;
      notifyPreGame(req, refreshed, state);
      res.json({ preGame: state });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/first-player-choice — body `{ choice: 'P1' | 'P2' }`.
   *
   * Seul le gagnant du pile ou face peut appeler. À la résolution, le duel
   * passe en `awaiting_choice → resolved`.
   */
  static async firstPlayerChoice(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);
      const raw = req.body?.choice;
      if (raw !== 'P1' && raw !== 'P2') {
        throw new ValidationError("Le choix doit valoir 'P1' ou 'P2'");
      }
      const state = await DuelPreGameModel.recordChoice(duel, req.user!.id, raw);
      const refreshed = (await DuelModel.findById(duel.id))!;
      notifyPreGame(req, refreshed, state);
      res.json({ preGame: state });
    } catch (err) {
      next(err);
    }
  }

  /** GET /duels/:id/engine/pre-game — état courant du pile ou face. */
  static async preGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);
      // Résout la deadline si elle est passée, pour ne pas retourner un état obsolète.
      if (duel.status === 'pre_game' && duel.phase_pre_game === 'awaiting_choice') {
        await DuelPreGameModel.resolveChoiceIfExpired(duel);
      }
      const refreshed = (await DuelModel.findById(duel.id))!;
      res.json({ preGame: DuelPreGameModel.snapshot(refreshed) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/:id/engine — l'état courant, du point de vue de l'appelant.
   */
  static async view(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel, seat } = await loadParticipantDuel(req);
      if (!isDuelLive(duel.id)) {
        throw new NotFoundError("Ce duel n'est pas ouvert dans le moteur");
      }
      const state = await viewEngineDuel(duel.id, seat);
      const withClocks = await attachClocks(duel.id, seat, state);
      res.json(withClocks);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/engine/choose — la décision du joueur.
   */
  static async choose(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel, seat } = await loadParticipantDuel(req);

      if (!isDuelLive(duel.id)) {
        throw new ValidationError("Ce duel n'est pas ouvert dans le moteur");
      }

      // Chrono à zéro : plutôt que d'accepter le coup on tranche la défaite.
      const loserId = DuelClockModel.loserOnZero(duel);
      if (loserId !== null) {
        const winnerId =
          loserId === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
        await DuelModel.finish(duel.id, winnerId);
        await DuelClockModel.stop(duel.id);
        await destroyEngineDuel(duel.id);
        notifySeats(req, duel);
        const io = req.app.get('io');
        if (io) {
          io.to(`duel:${duel.id}`).emit('duel:finished', {
            duelId: duel.id,
            winnerId,
            reason: 'timeout',
          });
        }
        throw new ValidationError('Temps écoulé — partie perdue au chrono');
      }

      const body = req.body as Partial<DuelChoice> | undefined;
      const optionIds = Array.isArray(body?.optionIds) ? body!.optionIds : [];
      if (!optionIds.every((id) => typeof id === 'string' && id.length <= 64)) {
        throw new ValidationError('Choix mal formé');
      }
      if (
        optionIds.length === 0 &&
        !body?.cancel &&
        body?.announcedCode === undefined &&
        !body?.counters &&
        !body?.cardCodes
      ) {
        throw new ValidationError('Aucune option choisie');
      }

      const choice: DuelChoice = {
        optionIds,
        cancel: body?.cancel === true,
        ...(body?.counters ? { counters: body.counters } : {}),
        ...(body?.announcedCode !== undefined ? { announcedCode: body.announcedCode } : {}),
        ...(body?.cardCodes ? { cardCodes: body.cardCodes } : {}),
      };
      const state = await chooseInEngine(duel.id, seat, choice);

      await DuelEngineModel.appendAction(duel.id, seat, choice);

      // Bascule le chrono sur le joueur à qui la nouvelle invite est adressée.
      if (state.status === 'awaiting_response' && state.prompt) {
        const nextUserId = userIdOfSeat(duel, state.prompt.seat);
        await DuelClockModel.startFor(duel.id, nextUserId);
      } else if (state.status === 'ended') {
        await DuelClockModel.stop(duel.id);
      }

      if (state.status === 'ended') {
        const winnerId =
          state.winner === null || state.winner === undefined
            ? null
            : userIdOfSeat(duel, state.winner);

        if (winnerId) {
          await DuelModel.finish(duel.id, winnerId);
          logger.info(`[DUEL_ENGINE] duel ${duel.id} terminé — vainqueur ${winnerId}`);
          // F4 · Match Bo3 — propage la victoire au match parent (score,
          // passage en sideboard ou finished).
          if (duel.match_id) {
            const match = await DuelMatchModel.recordGameWin(duel.match_id, winnerId);
            const io = req.app.get('io');
            if (match && io) {
              io.to(`user:${duel.challenger_id}`).emit('match:update', { match });
              io.to(`user:${duel.opponent_id}`).emit('match:update', { match });
            }
          }
        }
      }

      notifySeats(req, duel);
      const withClocks = await attachClocks(duel.id, seat, state);
      res.json(withClocks);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/engine/surrender — abandon côté moteur.
   *
   * Le mode manuel proposait déjà `surrender` via `duel:action` ; le moteur
   * n'avait pas d'équivalent. On termine la partie sans passer par le moteur —
   * abandonner n'a pas à se déclarer côté ygopro-core, c'est un choix hors-jeu.
   */
  static async surrender(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel } = await loadParticipantDuel(req);
      if (duel.status !== 'active') {
        throw new ValidationError("Ce duel n'est pas en cours");
      }

      const surrenderer = req.user!.id;
      const winnerId =
        surrenderer === duel.challenger_id ? duel.opponent_id : duel.challenger_id;

      await DuelModel.finish(duel.id, winnerId);
      await DuelClockModel.stop(duel.id);
      await destroyEngineDuel(duel.id).catch(() => undefined);
      // F4 · Match Bo3 — l'abandon compte pour le match parent aussi.
      if (duel.match_id) {
        await DuelMatchModel.recordGameWin(duel.match_id, winnerId).catch(() => null);
      }

      logger.info(`[DUEL_ENGINE] duel ${duel.id} abandon par ${surrenderer} → vainqueur ${winnerId}`);
      notifySeats(req, duel);
      const io = req.app.get('io');
      if (io) {
        io.to(`duel:${duel.id}`).emit('duel:finished', {
          duelId: duel.id,
          winnerId,
          reason: 'surrender',
        });
        if (duel.match_id) {
          const match = await DuelMatchModel.findById(duel.match_id);
          if (match) {
            io.to(`user:${duel.challenger_id}`).emit('match:update', { match });
            io.to(`user:${duel.opponent_id}`).emit('match:update', { match });
          }
        }
      }
      res.json({ ok: true, winnerId });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /duels/:id/engine — ferme l'instance et libère le tas du moteur.
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
   * POST /duels/:id/engine/announce-card/search — recherche typeahead ANNOUNCE_CARD.
   */
  static async announceSearch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { duel, seat } = await loadParticipantDuel(req);
      if (!isDuelLive(duel.id)) {
        throw new NotFoundError("Ce duel n'est pas ouvert dans le moteur");
      }
      const rawQuery = req.body?.query;
      const query = typeof rawQuery === 'string' ? rawQuery : '';
      if (query.length > 64) {
        throw new ValidationError('Requête trop longue');
      }
      const results = await announceCardSearch(duel.id, seat, query);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/:id/engine/spectate — vue en lecture seule (F7).
   *
   * Accès : le duel doit être actif ET (public OU le spectateur suit l'un des
   * joueurs). Sans ces règles, un utilisateur pourrait surveiller la partie
   * de n'importe qui — ce n'est pas ce qu'on veut. « Public » n'existe pas
   * encore sur `duels` : on retient pour l'instant « suit au moins un des
   * deux joueurs », qui couvre le cas raisonnable.
   *
   * Un participant qui appelle par mégarde reçoit sa vue normale via le seat
   * habituel — ici on refuse pour ne pas dupliquer la logique.
   */
  static async spectate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) throw new ValidationError('id invalide');

      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');

      // Les participants passent par `view`. Ils n'ont rien à gagner à basculer
      // en spectate — leur main deviendrait invisible.
      if (duel.challenger_id === req.user.id || duel.opponent_id === req.user.id) {
        throw new ValidationError('Utilisez /engine plutôt que /spectate pour votre propre duel');
      }
      if (duel.status !== 'active') {
        throw new ValidationError('Ce duel n\'est pas en cours');
      }

      // Contrôle d'accès — suit au moins un des deux joueurs.
      const [followsA, followsB] = await Promise.all([
        FollowModel.isFollowing(req.user.id, duel.challenger_id),
        FollowModel.isFollowing(req.user.id, duel.opponent_id),
      ]);
      if (!followsA && !followsB) {
        throw new ForbiddenError('Vous devez suivre au moins un des joueurs pour regarder');
      }

      if (!isDuelLive(duel.id)) {
        throw new NotFoundError('Ce duel n\'est pas ouvert dans le moteur');
      }
      const state = await spectateEngineDuel(duel.id);

      // Tag le spectateur dans la room du duel — permet aux joueurs de voir
      // le compteur de spectateurs. La room reste jointe côté socket via
      // `duel:join`, le broadcast normal fera son travail.
      res.json({ state, spectator: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/engine/rehydrate — force le rejeu d'un duel (F6, admin).
   *
   * Utile quand un duel bloque après un incident et que le worker a été
   * relancé sans que le duel soit réhydraté automatiquement (rare, mais on
   * garde l'échappatoire manuelle).
   */
  static async rehydrate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      if (req.user.role !== 'admin') throw new ForbiddenError('Réservé aux administrateurs');
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) throw new ValidationError('id invalide');
      const { rehydrateDuel } = await import('../services/duelEngine/rehydrate');
      const result = await rehydrateDuel(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /** GET /duels/engine/stats — santé du moteur, réservé à l'administration. */
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

/**
 * Enrichit une réponse `DuelStateResponse` avec les chronos du moment.
 *
 * Fait ici plutôt que dans le worker : les chronos vivent en base, pas dans le
 * tas WebAssembly du moteur. Un poll toutes les 3 s côté front donne la valeur
 * de référence, et le `setInterval` local fait tourner la seconde à l'écran
 * entre deux.
 */
async function attachClocks(
  duelId: number,
  seat: DuelSeat,
  state: import('../../../shared/duelView').DuelStateResponse
): Promise<import('../../../shared/duelView').DuelStateResponse> {
  const duel = await DuelModel.findById(duelId);
  if (!duel) return state;
  const { computeClocks, clocksForSeat } = await import('../models/duelClockModel');
  const snap = computeClocks(duel);
  return { ...state, clocks: clocksForSeat(duel, seat, snap) };
}
