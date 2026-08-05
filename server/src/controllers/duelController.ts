import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { loggers } from '../utils/logger';
import { DuelModel, DuelStatePatch } from '../models/duelModel';
import { UserModel } from '../models/userModel';
import { DeckModel } from '../models/deckModel';
import {
  BoardCard,
  DeckCard,
  Duel,
  DuelAction,
  DuelActionType,
  DuelChatMessage,
  DuelPhase,
  PlayerBoardState,
} from '../../../shared/types';

// ─── Helpers etat / cote joueur ────────────────────────────────────────────

type Side = 'challenger' | 'opponent';

/** Retourne le cote du joueur dans le duel, ou null si l'user n'y participe pas. */
function sideOf(duel: Duel, userId: number): Side | null {
  if (duel.challenger_id === userId) return 'challenger';
  if (duel.opponent_id === userId) return 'opponent';
  return null;
}

function otherSide(side: Side): Side {
  return side === 'challenger' ? 'opponent' : 'challenger';
}

function stateFor(duel: Duel, side: Side): PlayerBoardState | null {
  return (side === 'challenger' ? duel.challenger_state : duel.opponent_state) ?? null;
}

function lpFor(duel: Duel, side: Side): number {
  return side === 'challenger' ? duel.challenger_lp : duel.opponent_lp;
}

function userIdFor(duel: Duel, side: Side): number {
  return side === 'challenger' ? duel.challenger_id : duel.opponent_id;
}

/** Clone superficiel du plateau — les slots array sont recopies pour permettre la mutation. */
function cloneState(s: PlayerBoardState): PlayerBoardState {
  return {
    hand: [...s.hand],
    deck: [...s.deck],
    monsters: [...s.monsters],
    spellTraps: [...s.spellTraps],
    field: s.field ? { ...s.field, card: s.field.card } : null,
    graveyard: [...s.graveyard],
    banished: [...s.banished],
  };
}

function ensureState(duel: Duel, side: Side): PlayerBoardState {
  const s = stateFor(duel, side);
  if (!s) throw new ValidationError('Le duel n\'est pas encore initialise');
  return cloneState(s);
}

/** Trouve le premier slot vide (index) d'une zone de 5 cases. Retourne -1 si plein. */
function firstEmptySlot(zone: (BoardCard | null)[]): number {
  return zone.findIndex((s) => s === null);
}

/** Convertit un patch de state cote-oriente en DuelStatePatch pour le modele. */
function statePatch(side: Side, newState: PlayerBoardState): Pick<DuelStatePatch, 'challenger_state' | 'opponent_state'> {
  return side === 'challenger'
    ? { challenger_state: newState }
    : { opponent_state: newState };
}

function lpPatch(side: Side, newLp: number): Pick<DuelStatePatch, 'challenger_lp' | 'opponent_lp'> {
  return side === 'challenger' ? { challenger_lp: newLp } : { opponent_lp: newLp };
}

// ─── Application d'une action au duel ──────────────────────────────────────

/**
 * Applique une action au duel et renvoie le patch a persister + un flag
 * `finish` optionnel si l'action termine la partie (surrender / attack fatale).
 *
 * Note: cette fonction ne mute pas la DB — elle renvoie l'intention.
 * Elle levera ValidationError/ForbiddenError si l'action est invalide.
 */
function applyAction(
  duel: Duel,
  actorId: number,
  action: DuelAction
): { patch: DuelStatePatch; finish?: { winnerId: number } } {
  const side = sideOf(duel, actorId);
  if (!side) throw new ForbiddenError('Vous ne participez pas a ce duel');

  const isMyTurn = duel.current_turn_player_id === actorId;
  const type = action.type as DuelActionType;

  // chat / surrender : toujours autorises
  if (type === 'chat') {
    const message = String(action.payload?.message ?? '').trim();
    if (!message) throw new ValidationError('Message vide');
    if (message.length > 500) throw new ValidationError('Message trop long (500 max)');
    const chatEntry: DuelChatMessage = {
      user_id: actorId,
      message,
      at: new Date().toISOString(),
    };
    const chat_log = [...(duel.chat_log ?? []), chatEntry];
    return { patch: { chat_log } };
  }

  if (type === 'surrender') {
    const winnerId = userIdFor(duel, otherSide(side));
    return { patch: {}, finish: { winnerId } };
  }

  // Toute autre action ne peut se produire que sur un duel actif
  if (duel.status !== 'active') {
    throw new ValidationError('Le duel n\'est pas en cours');
  }

  // Actions cote adversaire interdites — sauf `attack` qui cible une zone adverse
  if (type !== 'attack' && !isMyTurn) {
    throw new ForbiddenError('Ce n\'est pas votre tour');
  }

  const myState = ensureState(duel, side);
  const foeSide = otherSide(side);
  const foeState = ensureState(duel, foeSide);
  const payload = action.payload ?? {};

  switch (type) {
    case 'draw': {
      const count = Math.max(1, Math.min(10, Number(payload.count) || 1));
      const drawn = myState.deck.splice(0, count);
      myState.hand.push(...drawn);
      return { patch: statePatch(side, myState) };
    }

    case 'place': {
      const fromHandIndex = Number(payload.fromHandIndex);
      if (!Number.isInteger(fromHandIndex) || fromHandIndex < 0 || fromHandIndex >= myState.hand.length) {
        throw new ValidationError('Carte en main introuvable');
      }
      const zone = payload.zone as 'monster' | 'spelltrap' | 'field';
      const [card] = myState.hand.splice(fromHandIndex, 1);
      const boardCard: BoardCard = {
        card,
        faceDown: Boolean(payload.faceDown),
        defenseMode: Boolean(payload.defenseMode),
      };
      if (zone === 'field') {
        // Le terrain precedent va au cimetiere
        if (myState.field) myState.graveyard.push(myState.field.card);
        myState.field = boardCard;
      } else {
        const target = zone === 'monster' ? myState.monsters : myState.spellTraps;
        let slot = Number.isInteger(payload.slotIndex) ? Number(payload.slotIndex) : firstEmptySlot(target);
        if (slot < 0 || slot >= target.length) throw new ValidationError('Slot invalide');
        if (target[slot] !== null) throw new ValidationError('Slot deja occupe');
        target[slot] = boardCard;
      }
      return { patch: statePatch(side, myState) };
    }

    case 'flip': {
      const zone = payload.zone as 'monster' | 'spelltrap' | 'field';
      if (zone === 'field') {
        if (!myState.field) throw new ValidationError('Aucun terrain a retourner');
        myState.field = {
          ...myState.field,
          faceDown: !myState.field.faceDown,
          defenseMode: payload.defenseMode !== undefined ? Boolean(payload.defenseMode) : myState.field.defenseMode,
        };
      } else {
        const target = zone === 'monster' ? myState.monsters : myState.spellTraps;
        const slot = Number(payload.slotIndex);
        if (!Number.isInteger(slot) || slot < 0 || slot >= target.length) throw new ValidationError('Slot invalide');
        const bc = target[slot];
        if (!bc) throw new ValidationError('Slot vide');
        target[slot] = {
          ...bc,
          faceDown: !bc.faceDown,
          defenseMode: payload.defenseMode !== undefined ? Boolean(payload.defenseMode) : bc.defenseMode,
        };
      }
      return { patch: statePatch(side, myState) };
    }

    case 'discard': {
      const fromHandIndex = Number(payload.fromHandIndex);
      if (!Number.isInteger(fromHandIndex) || fromHandIndex < 0 || fromHandIndex >= myState.hand.length) {
        throw new ValidationError('Carte en main introuvable');
      }
      const [card] = myState.hand.splice(fromHandIndex, 1);
      myState.graveyard.push(card);
      return { patch: statePatch(side, myState) };
    }

    case 'sendToGraveyard':
    case 'banish': {
      const zone = payload.zone as 'monster' | 'spelltrap' | 'field' | 'hand' | 'graveyard';
      const dest = type === 'banish' ? myState.banished : myState.graveyard;
      let card: DeckCard | null = null;

      if (zone === 'hand') {
        const idx = Number(payload.slotIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= myState.hand.length) throw new ValidationError('Carte main introuvable');
        [card] = myState.hand.splice(idx, 1);
      } else if (zone === 'field') {
        if (!myState.field) throw new ValidationError('Aucun terrain');
        card = myState.field.card;
        myState.field = null;
      } else if (zone === 'graveyard') {
        if (type !== 'banish') throw new ValidationError('Zone invalide pour cette action');
        const idx = Number(payload.slotIndex);
        if (!Number.isInteger(idx) || idx < 0 || idx >= myState.graveyard.length) throw new ValidationError('Carte cimetiere introuvable');
        [card] = myState.graveyard.splice(idx, 1);
      } else {
        const target = zone === 'monster' ? myState.monsters : myState.spellTraps;
        const slot = Number(payload.slotIndex);
        if (!Number.isInteger(slot) || slot < 0 || slot >= target.length) throw new ValidationError('Slot invalide');
        const bc = target[slot];
        if (!bc) throw new ValidationError('Slot vide');
        card = bc.card;
        target[slot] = null;
      }

      if (card) dest.push(card);
      return { patch: statePatch(side, myState) };
    }

    case 'attack': {
      // attack : action offensive — ne necessite pas d'etre "mon tour" (deja verifie plus haut).
      // Mais elle DOIT etre mon tour + phase battle.
      if (!isMyTurn) throw new ForbiddenError('Ce n\'est pas votre tour');
      if (duel.current_phase !== 'battle') {
        throw new ValidationError('Attaque possible uniquement en phase de combat');
      }

      const attackerSlot = Number(payload.attackerSlot);
      if (!Number.isInteger(attackerSlot) || attackerSlot < 0 || attackerSlot >= myState.monsters.length) {
        throw new ValidationError('Attaquant invalide');
      }
      const attacker = myState.monsters[attackerSlot];
      if (!attacker || !attacker.card.card) throw new ValidationError('Aucun monstre a cette position');
      if (attacker.faceDown) throw new ValidationError('Un monstre face verso ne peut pas attaquer');
      if (attacker.defenseMode) throw new ValidationError('Un monstre en defense ne peut pas attaquer');

      const attackerAtk = attacker.card.card.atk ?? 0;
      const targetSlotRaw = payload.targetSlot;
      const foeMonstersOccupied = foeState.monsters.some((m) => m !== null);

      // Attaque directe : autorisee UNIQUEMENT si l'adversaire n'a aucun monstre
      if (targetSlotRaw === null || targetSlotRaw === undefined) {
        if (foeMonstersOccupied) throw new ValidationError('Attaque directe interdite si l\'adversaire a des monstres');
        const newFoeLp = Math.max(0, lpFor(duel, foeSide) - attackerAtk);
        const patch: DuelStatePatch = {
          ...lpPatch(foeSide, newFoeLp),
        };
        if (newFoeLp <= 0) {
          return { patch, finish: { winnerId: actorId } };
        }
        return { patch };
      }

      const targetSlot = Number(targetSlotRaw);
      if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= foeState.monsters.length) {
        throw new ValidationError('Cible invalide');
      }
      const target = foeState.monsters[targetSlot];
      if (!target || !target.card.card) throw new ValidationError('Aucun monstre sur cette cible');

      const targetAtk = target.card.card.atk ?? 0;
      const targetDef = target.card.card.def ?? 0;
      const targetIsDef = Boolean(target.defenseMode) || target.faceDown;
      // Un monstre face verso revele automatiquement au combat
      const revealedTarget: BoardCard = { ...target, faceDown: false };

      let attackerLpDiff = 0;
      let defenderLpDiff = 0;
      let attackerDestroyed = false;
      let defenderDestroyed = false;

      if (targetIsDef) {
        // Attaque vs defense : compare atk attaquant vs def defenseur
        if (attackerAtk > targetDef) {
          defenderDestroyed = true;
        } else if (attackerAtk < targetDef) {
          // Attaquant perd la difference
          attackerLpDiff = -(targetDef - attackerAtk);
        } // egalite : rien
      } else {
        // Attaque vs attaque
        if (attackerAtk > targetAtk) {
          defenderDestroyed = true;
          defenderLpDiff = -(attackerAtk - targetAtk);
        } else if (attackerAtk < targetAtk) {
          attackerDestroyed = true;
          attackerLpDiff = -(targetAtk - attackerAtk);
        } else {
          attackerDestroyed = true;
          defenderDestroyed = true;
        }
      }

      if (attackerDestroyed) {
        myState.graveyard.push(attacker.card);
        myState.monsters[attackerSlot] = null;
      }
      if (defenderDestroyed) {
        foeState.graveyard.push(revealedTarget.card);
        foeState.monsters[targetSlot] = null;
      } else if (target.faceDown) {
        // La cible non detruite a ete revelee — on garde la revelation
        foeState.monsters[targetSlot] = revealedTarget;
      }

      const newMyLp = Math.max(0, lpFor(duel, side) + attackerLpDiff);
      const newFoeLp = Math.max(0, lpFor(duel, foeSide) + defenderLpDiff);

      const patch: DuelStatePatch = {
        ...statePatch(side, myState),
        ...statePatch(foeSide, foeState),
        ...lpPatch(side, newMyLp),
        ...lpPatch(foeSide, newFoeLp),
      };

      if (newFoeLp <= 0) return { patch, finish: { winnerId: actorId } };
      if (newMyLp <= 0) return { patch, finish: { winnerId: userIdFor(duel, foeSide) } };

      return { patch };
    }

    case 'advance_phase': {
      const phases: DuelPhase[] = ['draw', 'main1', 'battle', 'main2', 'end'];
      const current = duel.current_phase ?? 'draw';
      const idx = phases.indexOf(current);
      const next = phases[Math.min(idx + 1, phases.length - 1)];
      return { patch: { current_phase: next } };
    }

    case 'end_turn': {
      const foeId = userIdFor(duel, foeSide);
      const newTurn = duel.turn_number + 1;
      // Auto-draw pour le nouveau joueur actif (les regles YGO reelles skippent le draw
      // du tout premier tour du 1er joueur ; ici c'est deja fait a l'init — on tire
      // systematiquement pour chaque tour suivant).
      const drawn = foeState.deck.splice(0, 1);
      foeState.hand.push(...drawn);
      return {
        patch: {
          ...statePatch(foeSide, foeState),
          current_turn_player_id: foeId,
          current_phase: 'draw',
          turn_number: newTurn,
        },
      };
    }

    default:
      throw new ValidationError(`Type d'action inconnu: ${type}`);
  }
}

// ─── Controllers HTTP ─────────────────────────────────────────────────────

export class DuelController {
  /**
   * POST /duels — challenge un autre joueur.
   * Body: { opponent_id | opponent_username, challenger_deck_id? }
   */
  static async challenge(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');

      const { opponent_id, opponent_username, challenger_deck_id, rules_mode } = req.body;
      let opponentId: number | null = null;
      // Mode de regles : 'standard' (banlist TCG appliquee, defaut) ou 'free'
      // (aucune restriction hors tailles minimum). Le challenger decide au
      // moment du defi, l'opponent le voit dans la pop-up d'acceptation.
      const rulesMode: 'standard' | 'free' =
        rules_mode === 'free' ? 'free' : 'standard';

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
        throw new ValidationError('Impossible de se defier soi-meme');
      }

      // Verifie que le deck existe et appartient au challenger (si fourni)
      let deckId: number | null = null;
      if (challenger_deck_id !== undefined && challenger_deck_id !== null) {
        deckId = Number(challenger_deck_id);
        if (!Number.isInteger(deckId)) throw new ValidationError('challenger_deck_id invalide');
        const deck = await DeckModel.findById(deckId);
        if (!deck) throw new NotFoundError('Deck introuvable');
        if (deck.user_id !== req.user.id) throw new ForbiddenError('Ce deck ne vous appartient pas');
      }

      // Interdit les duels pending en double entre les 2 users
      const existing = await DuelModel.findPendingBetween(req.user.id, opponentId);
      if (existing) {
        throw new ValidationError('Un duel est deja en attente entre vous et ce joueur');
      }

      const duel = await DuelModel.create(req.user.id, opponentId, deckId, rulesMode);
      loggers.api.request('POST', '/duels', req.user.id);

      // Notification WebSocket a l'opponent (room user:${id} deja rejointe a la co)
      const io = req.app.get('io');
      if (io) io.to(`user:${opponentId}`).emit('duel:challenged', { duel });

      res.status(201).json({ duel });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels — liste des duels de l'user (?status= optionnel).
   */
  static async listMyDuels(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const status = req.query.status as string | undefined;
      const allowed = ['pending', 'active', 'finished', 'cancelled'];
      if (status && !allowed.includes(status)) {
        throw new ValidationError('Status invalide');
      }
      const duels = await DuelModel.listByUser(req.user.id, status as any);
      res.json({ duels });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /duels/:id — detail d'un duel.
   * Le user demandeur doit y participer, sinon 403.
   */
  static async getDuel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      if (!sideOf(duel, req.user.id)) throw new ForbiddenError('Vous ne participez pas a ce duel');
      res.json({ duel });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/accept — l'opponent accepte + choisit son deck.
   */
  static async accept(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const deckId = Number(req.body.deck_id);
      if (!Number.isInteger(deckId)) throw new ValidationError('deck_id requis');

      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      if (duel.opponent_id !== req.user.id) throw new ForbiddenError('Vous n\'etes pas l\'adversaire');
      if (duel.status !== 'pending') throw new ValidationError('Duel deja traite');

      // Verifie que le deck appartient a l'opponent
      const deck = await DeckModel.findById(deckId);
      if (!deck) throw new NotFoundError('Deck introuvable');
      if (deck.user_id !== req.user.id) throw new ForbiddenError('Ce deck ne vous appartient pas');

      const updated = await DuelModel.accept(id, deckId);
      if (!updated) throw new ValidationError('Impossible d\'accepter le duel (deck du challenger manquant ou vide ?)');

      const io = req.app.get('io');
      if (io) {
        io.to(`duel:${id}`).emit('duel:accepted', { duel: updated });
        io.to(`user:${duel.challenger_id}`).emit('duel:accepted', { duel: updated });
      }

      res.json({ duel: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/reject — l'opponent refuse.
   */
  static async reject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      if (duel.opponent_id !== req.user.id) throw new ForbiddenError('Vous n\'etes pas l\'adversaire');
      if (duel.status !== 'pending') throw new ValidationError('Duel deja traite');
      await DuelModel.reject(id);
      const io = req.app.get('io');
      if (io) io.to(`user:${duel.challenger_id}`).emit('duel:rejected', { duelId: id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/cancel — le challenger annule avant acceptation.
   */
  static async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      if (duel.challenger_id !== req.user.id) throw new ForbiddenError('Vous n\'etes pas le challenger');
      if (duel.status !== 'pending') throw new ValidationError('Duel deja traite');
      await DuelModel.cancel(id);
      const io = req.app.get('io');
      if (io) io.to(`user:${duel.opponent_id}`).emit('duel:cancelled', { duelId: id });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/change-deck — un joueur change son deck depuis le lobby.
   *
   * Body : `{ deck_id: number }`.
   *
   * Autorisé uniquement tant que la phase pré-game n'a pas démarré ET que
   * le joueur n'est pas déjà « prêt ». Émet `duel:deck-changed` aux deux
   * joueurs pour rafraîchir l'affichage temps réel de l'adversaire.
   */
  static async changeDeck(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const deckId = Number(req.body?.deck_id);
      if (!Number.isInteger(deckId)) throw new ValidationError('deck_id requis');

      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      const side = sideOf(duel, req.user.id);
      if (!side) throw new ForbiddenError('Vous ne participez pas a ce duel');
      if (duel.phase_pre_game) {
        throw new ValidationError('Trop tard — le pile ou face a déjà démarré');
      }
      const alreadyReady = side === 'challenger' ? duel.challenger_ready : duel.opponent_ready;
      if (alreadyReady) {
        throw new ValidationError('Vous êtes déjà prêt — annulez pour changer de deck');
      }

      const deck = await DeckModel.findById(deckId);
      if (!deck) throw new NotFoundError('Deck introuvable');
      if (deck.user_id !== req.user.id) throw new ForbiddenError('Ce deck ne vous appartient pas');

      const updated = await DuelModel.changeDeck(id, side, deckId);
      if (!updated) throw new ValidationError('Impossible de changer de deck maintenant');

      const io = req.app.get('io');
      if (io) {
        io.to(`duel:${id}`).emit('duel:deck-changed', { duel: updated });
        io.to(`user:${duel.challenger_id}`).emit('duel:deck-changed', { duel: updated });
        io.to(`user:${duel.opponent_id}`).emit('duel:deck-changed', { duel: updated });
      }

      res.json({ duel: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/ready — un joueur clique « Prêt » dans le lobby.
   *
   * Body : `{ ready?: boolean }` (défaut `true`).
   *
   * Marque le joueur comme prêt. Quand les deux joueurs le sont, le duel
   * reste en `active` — le passage au coin flip est déclenché par l'appel
   * à `/duels/:id/engine/start` que fera le front en atterrissant sur
   * `/duel/:id`. Ce découplage évite de dépendre de l'ordre des messages.
   */
  static async setReady(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');

      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      const side = sideOf(duel, req.user.id);
      if (!side) throw new ForbiddenError('Vous ne participez pas a ce duel');
      if (duel.phase_pre_game) {
        // Idempotent : si on est déjà en pile ou face, on renvoie le duel tel quel.
        res.json({ duel });
        return;
      }
      // Un deck est requis pour se déclarer prêt.
      const myDeckId = side === 'challenger' ? duel.challenger_deck_id : duel.opponent_deck_id;
      if (!myDeckId) throw new ValidationError('Choisissez un deck avant de vous déclarer prêt');

      const updated = await DuelModel.setReady(id, side);
      if (!updated) throw new ValidationError('Impossible de vous déclarer prêt');

      const bothReady = updated.challenger_ready && updated.opponent_ready;

      const io = req.app.get('io');
      if (io) {
        const payload = { duel: updated, bothReady };
        io.to(`duel:${id}`).emit('duel:ready-changed', payload);
        io.to(`user:${duel.challenger_id}`).emit('duel:ready-changed', payload);
        io.to(`user:${duel.opponent_id}`).emit('duel:ready-changed', payload);
      }

      res.json({ duel: updated, bothReady });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /duels/:id/action — applique une action + broadcast.
   */
  static async performAction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new ValidationError('Not authenticated');
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('id invalide');
      const { type, payload } = req.body || {};
      if (!type) throw new ValidationError('type d\'action requis');

      const duel = await DuelModel.findById(id);
      if (!duel) throw new NotFoundError('Duel introuvable');
      if (!sideOf(duel, req.user.id)) throw new ForbiddenError('Vous ne participez pas a ce duel');

      const action: DuelAction = { type, payload: payload ?? {} };
      const { patch, finish } = applyAction(duel, req.user.id, action);

      let updated = await DuelModel.updateState(id, patch);
      if (finish && updated) {
        updated = await DuelModel.finish(id, finish.winnerId);
      }

      const io = req.app.get('io');
      if (io) {
        io.to(`duel:${id}`).emit('duel:action', {
          duel: updated,
          action,
          actorId: req.user.id,
        });
        if (finish) {
          io.to(`duel:${id}`).emit('duel:finished', {
            duel: updated,
            winnerId: finish.winnerId,
          });
        }
      }

      res.json({ duel: updated });
    } catch (err) {
      next(err);
    }
  }
}
