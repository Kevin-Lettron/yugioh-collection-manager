import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { query } from '../config/database';
import logger from '../utils/logger';
import { DuelModel } from '../models/duelModel';
import { DuelMatchModel, winsNeeded, type DuelMatch } from '../models/duelMatchModel';
import { DuelSideDeckModel } from '../models/duelSideDeckModel';
import { DeckModel } from '../models/deckModel';
import { UserModel } from '../models/userModel';

/**
 * Contrôleur des matches Bo3.
 *
 * Un match regroupe 1 à 3 duels — la première manche est créée dès le match
 * accepté ; les manches 2 et 3 le sont via `next-game`, une fois que les deux
 * joueurs ont soumis leur composition de side-deck.
 *
 * Ce contrôleur ne parle **jamais** au moteur : il gère la couche match/side,
 * puis délègue à `DuelEngineController.start` pour l'ouverture effective de
 * la manche courante.
 */
export class DuelMatchController {
  /**
   * POST /duels/matches — crée un match Bo1/Bo2/Bo3 avec un autre joueur.
   *
   * Body : `{ opponent_id | opponent_username, best_of, challenger_deck_id? }`.
   * Le premier duel enfant est créé automatiquement (manche 1) pour que le
   * flow accept/pré-game/moteur soit identique aux duels libres.
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');

      const { opponent_id, opponent_username, best_of, challenger_deck_id } = req.body ?? {};
      const bestOf = Number(best_of);
      if (![1, 2, 3].includes(bestOf)) {
        throw new ValidationError('best_of doit valoir 1, 2 ou 3');
      }

      let opponentId: number | null = null;
      if (opponent_id) {
        opponentId = Number(opponent_id);
        if (!Number.isInteger(opponentId) || opponentId <= 0) {
          throw new ValidationError('opponent_id invalide');
        }
      } else if (opponent_username) {
        const opp = await UserModel.findByUsername(String(opponent_username));
        if (!opp) throw new NotFoundError('Utilisateur adverse introuvable');
        opponentId = opp.id;
      } else {
        throw new ValidationError('opponent_id ou opponent_username requis');
      }

      if (opponentId === req.user.id) {
        throw new ValidationError('Impossible de se défier soi-même');
      }

      let deckId: number | null = null;
      if (challenger_deck_id !== undefined && challenger_deck_id !== null) {
        deckId = Number(challenger_deck_id);
        if (!Number.isInteger(deckId)) throw new ValidationError('challenger_deck_id invalide');
        const deck = await DeckModel.findById(deckId);
        if (!deck) throw new NotFoundError('Deck introuvable');
        if (deck.user_id !== req.user.id) {
          throw new ForbiddenError('Ce deck ne vous appartient pas');
        }
      }

      const match = await DuelMatchModel.create(req.user.id, opponentId, bestOf as 1 | 2 | 3);
      const firstDuel = await DuelModel.create(req.user.id, opponentId, deckId);
      // Rattache le duel au match, manche 1.
      await query(
        `UPDATE duels SET match_id = $1, game_number = 1 WHERE id = $2`,
        [match.id, firstDuel.id]
      );

      const io = req.app.get('io');
      if (io) io.to(`user:${opponentId}`).emit('duel:challenged', { duel: { ...firstDuel, match_id: match.id, game_number: 1 } });

      logger.info(`[DUEL_MATCH] match ${match.id} créé (Bo${bestOf}, duel ${firstDuel.id})`);
      res.status(201).json({ match, firstDuelId: firstDuel.id });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/matches/:id — état du match + liste des manches.
   */
  static async view(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) throw new ValidationError('id invalide');
      const match = await DuelMatchModel.findById(id);
      if (!match) throw new NotFoundError('Match introuvable');
      if (![match.challenger_id, match.opponent_id].includes(req.user.id)) {
        throw new ForbiddenError('Vous ne participez pas à ce match');
      }
      const games = await DuelMatchModel.listGames(id);
      const myGame = games[games.length - 1] ?? null;
      const submissions =
        match.status === 'sideboard' && myGame
          ? await DuelSideDeckModel.listForGame(id, ((myGame.game_number + 1) as 2 | 3))
          : [];
      res.json({
        match: { ...match, games },
        // Uniquement utile en phase sideboard : liste des user_id qui ont déjà soumis.
        submittedBy: submissions.map((s) => s.user_id),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/matches/:matchId/side-deck/submit
   *
   * Body : `{ main: number[], extra: number[], side: number[] }` — les IDs
   * `cards.id` (jamais les passcodes). Contrôles :
   *   - 40 ≤ main.length ≤ 60
   *   - extra.length ≤ 15
   *   - side.length ≤ 15
   *   - le contenu (main ∪ extra ∪ side) reste égal à celui de la manche
   *     précédente : impossible d'introduire une carte que le joueur ne possédait
   *     pas déjà. Sinon la side-board serait un vecteur de triche.
   */
  static async submitSideDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const matchId = Number(req.params.matchId);
      if (!Number.isInteger(matchId)) throw new ValidationError('matchId invalide');

      const match = await DuelMatchModel.findById(matchId);
      if (!match) throw new NotFoundError('Match introuvable');
      if (![match.challenger_id, match.opponent_id].includes(req.user.id)) {
        throw new ForbiddenError('Vous ne participez pas à ce match');
      }
      if (match.status !== 'sideboard') {
        throw new ValidationError('Le sideboard n\'est pas ouvert');
      }

      const body = req.body ?? {};
      const mainIds = normalizeIntList(body.main, 'main');
      const extraIds = normalizeIntList(body.extra, 'extra');
      const sideIds = normalizeIntList(body.side, 'side');

      if (mainIds.length < 40 || mainIds.length > 60) {
        throw new ValidationError(`Main Deck : ${mainIds.length} cartes (attendu 40-60)`);
      }
      if (extraIds.length > 15) {
        throw new ValidationError(`Extra Deck : ${extraIds.length} cartes (max 15)`);
      }
      if (sideIds.length > 15) {
        throw new ValidationError(`Side Deck : ${sideIds.length} cartes (max 15)`);
      }

      // La composition (main ∪ extra ∪ side), triée avec multiplicité, doit être
      // identique à celle du deck source (manche précédente). Sans ce contrôle,
      // n'importe qui pourrait « sideboarder » vers un tout autre deck.
      const games = await DuelMatchModel.listGames(matchId);
      const lastGame = games[games.length - 1];
      if (!lastGame) throw new ValidationError('Aucune manche jouée — impossible de sideboarder');
      const gameNumber = (lastGame.game_number + 1) as 2 | 3;

      // Récupère la composition de base à laquelle on doit rester fidèle : soit
      // la soumission précédente du joueur, soit le deck initial de la manche 1.
      const baselineIds = await baselineFor(match, req.user.id, gameNumber);
      if (!sameMultiset([...mainIds, ...extraIds, ...sideIds], baselineIds)) {
        throw new ValidationError(
          "La composition doit couvrir les mêmes cartes que la manche précédente"
        );
      }

      const submission = await DuelSideDeckModel.submit(
        matchId,
        req.user.id,
        gameNumber,
        mainIds,
        extraIds,
        sideIds
      );

      // Prévient les deux clients qu'une nouvelle soumission est là.
      const io = req.app.get('io');
      if (io) io.to(`user:${match.challenger_id}`).emit('match:side_submitted', { matchId, userId: req.user.id, gameNumber });
      if (io) io.to(`user:${match.opponent_id}`).emit('match:side_submitted', { matchId, userId: req.user.id, gameNumber });

      res.json({ submission });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/matches/:matchId/next-game
   *
   * Une fois les 2 soumissions posées, crée le duel enfant de la prochaine
   * manche (statut `pending` → l'adversaire n'a rien à accepter, le premier
   * `engine/start` déclenche le pré-game). Le match revient en `active`.
   */
  static async nextGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const matchId = Number(req.params.matchId);
      if (!Number.isInteger(matchId)) throw new ValidationError('matchId invalide');
      const match = await DuelMatchModel.findById(matchId);
      if (!match) throw new NotFoundError('Match introuvable');
      if (![match.challenger_id, match.opponent_id].includes(req.user.id)) {
        throw new ForbiddenError('Vous ne participez pas à ce match');
      }
      if (match.status !== 'sideboard') {
        throw new ValidationError('Le match n\'est pas en phase sideboard');
      }

      const games = await DuelMatchModel.listGames(matchId);
      const lastGame = games[games.length - 1];
      if (!lastGame) throw new ValidationError('Aucune manche jouée');
      const gameNumber = (lastGame.game_number + 1) as 2 | 3;

      // Les deux soumissions doivent être présentes — sinon on attend.
      const submissions = await DuelSideDeckModel.listForGame(matchId, gameNumber);
      const submittedIds = new Set(submissions.map((s) => s.user_id));
      if (!submittedIds.has(match.challenger_id) || !submittedIds.has(match.opponent_id)) {
        throw new ValidationError('Les deux joueurs doivent soumettre leur side deck');
      }

      // Nouveau duel enfant. Les decks utilisés seront réhydratés depuis les
      // soumissions au moment du `engine/start` — ici on ne stocke que la clé
      // deck_id d'origine, qui sert d'ancre.
      const parentDeckIds = await parentDeckIdsFor(match.id);
      const newDuel = await DuelModel.create(match.challenger_id, match.opponent_id, parentDeckIds.challengerDeckId);
      await query(
        `UPDATE duels
            SET match_id = $1,
                game_number = $2,
                opponent_deck_id = $3,
                status = 'active',
                challenger_state = '{}'::jsonb,
                opponent_state = '{}'::jsonb,
                turn_number = 1,
                current_phase = 'draw'
          WHERE id = $4`,
        [matchId, gameNumber, parentDeckIds.opponentDeckId, newDuel.id]
      );

      await DuelMatchModel.setActiveNextGame(matchId);

      // Prévient les deux joueurs qu'un nouveau duel les attend.
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${match.challenger_id}`).emit('match:next_game', { matchId, duelId: newDuel.id, gameNumber });
        io.to(`user:${match.opponent_id}`).emit('match:next_game', { matchId, duelId: newDuel.id, gameNumber });
      }

      res.json({ duelId: newDuel.id, gameNumber });
    } catch (err) {
      next(err);
    }
  }
}

/**
 * Retourne les deck_id challenger/opponent utilisés à la manche 1 — ils servent
 * d'ancres pour toutes les manches suivantes. Sans eux, on ne saurait pas
 * comparer une soumission avec sa composition initiale.
 */
async function parentDeckIdsFor(matchId: number): Promise<{
  challengerDeckId: number | null;
  opponentDeckId: number | null;
}> {
  const res = await query(
    `SELECT challenger_deck_id, opponent_deck_id
       FROM duels
      WHERE match_id = $1
      ORDER BY game_number ASC
      LIMIT 1`,
    [matchId]
  );
  return {
    challengerDeckId: res.rows[0]?.challenger_deck_id ?? null,
    opponentDeckId: res.rows[0]?.opponent_deck_id ?? null,
  };
}

/**
 * Liste attendue pour un side deck : la composition (main ∪ extra ∪ side) de
 * la manche précédente, avec multiplicité — soit la soumission du joueur pour
 * la manche précédente, soit son deck de base à la manche 1.
 */
async function baselineFor(
  match: DuelMatch,
  userId: number,
  gameNumber: 2 | 3
): Promise<number[]> {
  if (gameNumber === 3) {
    // On compare à la soumission de la manche 2.
    const prev = await DuelSideDeckModel.findForUser(match.id, userId, 2);
    if (prev) return [...prev.main_cards, ...prev.extra_cards, ...prev.side_cards];
  }
  // Sinon (gameNumber === 2 ou pas de soumission précédente) : deck de base.
  const parent = await parentDeckIdsFor(match.id);
  const deckId =
    userId === match.challenger_id ? parent.challengerDeckId : parent.opponentDeckId;
  if (!deckId) return [];
  const deck = await DeckModel.findById(deckId);
  if (!deck) return [];
  const ids: number[] = [];
  for (const dc of deck.main_deck ?? []) {
    for (let i = 0; i < Math.max(1, dc.quantity); i++) ids.push(dc.card_id);
  }
  for (const dc of deck.extra_deck ?? []) {
    for (let i = 0; i < Math.max(1, dc.quantity); i++) ids.push(dc.card_id);
  }
  for (const dc of deck.side_deck ?? []) {
    for (let i = 0; i < Math.max(1, dc.quantity); i++) ids.push(dc.card_id);
  }
  return ids;
}

function normalizeIntList(raw: unknown, label: string): number[] {
  if (!Array.isArray(raw)) throw new ValidationError(`${label} doit être un tableau`);
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) {
      throw new ValidationError(`${label} contient une valeur invalide : ${JSON.stringify(v)}`);
    }
    out.push(n);
  }
  return out;
}

function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const count = new Map<number, number>();
  for (const v of a) count.set(v, (count.get(v) ?? 0) + 1);
  for (const v of b) {
    const c = count.get(v);
    if (!c) return false;
    if (c === 1) count.delete(v);
    else count.set(v, c - 1);
  }
  return count.size === 0;
}
