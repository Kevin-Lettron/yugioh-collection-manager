import { query } from '../../config/database';
import logger from '../../utils/logger';
import { DuelModel } from '../../models/duelModel';
import { DeckModel } from '../../models/deckModel';
import { DuelEngineModel } from '../../models/duelEngineModel';
import { DuelSideDeckModel } from '../../models/duelSideDeckModel';
import { deckToEngine, buildEngineDeckFromIds, checkEngineDeck } from './deckLoader';
import {
  createEngineDuel,
  chooseInEngine,
  destroyEngineDuel,
  isDuelLive,
} from './engineClient';
import type { DuelChoice, DuelSeat } from '../../../../shared/duelView';

/**
 * F6 · Reprise après redémarrage.
 *
 * ygopro-core n'expose aucune sérialisation d'un duel en cours ; on ne peut
 * donc pas « sauver l'état ». En revanche, on garde :
 *   1. la **graine** du duel (colonne `duels.engine_seed`)
 *   2. la **suite exacte des décisions** de chaque joueur (`duel_engine_actions`)
 *
 * Même graine + mêmes décisions = même partie, le moteur étant déterministe.
 * `rehydrateDuel` recrée une session moteur, y rejoue le journal séquentiel, et
 * termine dans le même état que la partie interrompue.
 */

export interface RehydrateResult {
  duelId: number;
  ok: boolean;
  replayedActions: number;
  error?: string;
}

/**
 * Rejoue un duel depuis son journal.
 *
 * Attention : on n'utilise pas `viewEngineDuel` en boucle — chaque action se
 * fait via `chooseInEngine`, qui poussera à travers le worker. C'est plus lent
 * mais c'est la seule voie qui va bien : `buildResponse` a besoin du contexte
 * de l'invite courante pour traduire `optionIds` en réponse moteur.
 */
export async function rehydrateDuel(duelId: number): Promise<RehydrateResult> {
  const duel = await DuelModel.findById(duelId);
  if (!duel) return { duelId, ok: false, replayedActions: 0, error: 'duel introuvable' };
  if (duel.status !== 'active') {
    return { duelId, ok: false, replayedActions: 0, error: 'duel non actif' };
  }
  // `engine_mode` n'est pas exposé par le rowToDuel, on relit directement.
  const modeRow = await query('SELECT engine_mode FROM duels WHERE id = $1', [duelId]);
  if (!modeRow.rows[0]?.engine_mode) {
    return { duelId, ok: false, replayedActions: 0, error: 'duel hors moteur' };
  }

  const seed = await DuelEngineModel.readSeed(duelId);
  if (!seed || seed.length !== 4) {
    return { duelId, ok: false, replayedActions: 0, error: 'graine absente ou invalide' };
  }

  // Compose les decks : soit soumission side-deck (manche ≥ 2), soit deck de base.
  let players: [
    { main: number[]; extra: number[] },
    { main: number[]; extra: number[] },
  ];
  try {
    if (duel.match_id && (duel.game_number ?? 1) >= 2) {
      const gameNumber = (duel.game_number ?? 2) as 2 | 3;
      const [challengerSub, opponentSub] = await Promise.all([
        DuelSideDeckModel.findForUser(duel.match_id, duel.challenger_id, gameNumber),
        DuelSideDeckModel.findForUser(duel.match_id, duel.opponent_id, gameNumber),
      ]);
      if (!challengerSub || !opponentSub) {
        return { duelId, ok: false, replayedActions: 0, error: 'side deck manquant pour manche ≥ 2' };
      }
      const [cConv, oConv] = await Promise.all([
        buildEngineDeckFromIds(challengerSub.main_cards, challengerSub.extra_cards),
        buildEngineDeckFromIds(opponentSub.main_cards, opponentSub.extra_cards),
      ]);
      const cProblem = checkEngineDeck(cConv);
      const oProblem = checkEngineDeck(oConv);
      if (cProblem || oProblem) {
        return { duelId, ok: false, replayedActions: 0, error: cProblem ?? oProblem ?? 'deck invalide' };
      }
      players = [cConv.deck, oConv.deck];
    } else {
      const [challengerDeck, opponentDeck] = await Promise.all([
        DeckModel.findById(duel.challenger_deck_id!),
        DeckModel.findById(duel.opponent_deck_id!),
      ]);
      if (!challengerDeck || !opponentDeck) {
        return { duelId, ok: false, replayedActions: 0, error: 'deck introuvable' };
      }
      const cConv = deckToEngine(challengerDeck);
      const oConv = deckToEngine(opponentDeck);
      const cProblem = checkEngineDeck(cConv);
      const oProblem = checkEngineDeck(oConv);
      if (cProblem || oProblem) {
        return { duelId, ok: false, replayedActions: 0, error: cProblem ?? oProblem ?? 'deck invalide' };
      }
      players = [cConv.deck, oConv.deck];
    }
  } catch (err) {
    return {
      duelId,
      ok: false,
      replayedActions: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Ordre des joueurs — cohérent avec `duelEngineController.start`.
  const challengerIsFirst =
    !duel.first_player_id || duel.first_player_id === duel.challenger_id;
  const orderedPlayers: [typeof players[0], typeof players[1]] = challengerIsFirst
    ? [players[0], players[1]]
    : [players[1], players[0]];

  // Si le duel est déjà vivant côté moteur, on ne le recrée pas — quelqu'un
  // l'a rehydraté avant nous.
  if (isDuelLive(duelId)) {
    return { duelId, ok: true, replayedActions: 0 };
  }

  try {
    await createEngineDuel({
      duelId,
      seat: 0,
      players: orderedPlayers,
      seed: [seed[0], seed[1], seed[2], seed[3]] as [bigint, bigint, bigint, bigint],
    });
  } catch (err) {
    return {
      duelId,
      ok: false,
      replayedActions: 0,
      error: `create: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Rejoue le journal — séquentiel, chaque `chooseInEngine` pumping la file.
  const actions = await DuelEngineModel.readActions(duelId);
  let replayed = 0;
  for (const { seat, choice } of actions) {
    try {
      const choicePayload: DuelChoice = {
        optionIds: choice.optionIds ?? [],
        ...(choice.cancel ? { cancel: true } : {}),
      };
      await chooseInEngine(duelId, seat as DuelSeat, choicePayload);
      replayed++;
    } catch (err) {
      // Une réponse peut échouer si le journal a été trafiqué ou si la version
      // du moteur a changé ; on marque l'échec et sort.
      await destroyEngineDuel(duelId).catch(() => undefined);
      return {
        duelId,
        ok: false,
        replayedActions: replayed,
        error: `replay@${replayed}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { duelId, ok: true, replayedActions: replayed };
}

/**
 * Rejoue tous les duels `active` à l'ouverture du serveur.
 *
 * On applique la rehydration en série pour ne pas saturer le worker au boot ;
 * ils sont typiquement 0-5, ce n'est pas critique.
 */
export async function rehydrateActiveDuels(): Promise<{ total: number; ok: number; ko: number }> {
  const res = await query(
    `SELECT id FROM duels WHERE status = 'active' AND engine_mode = TRUE ORDER BY id`
  );
  const ids: number[] = res.rows.map((r) => r.id);
  let ok = 0;
  let ko = 0;
  for (const id of ids) {
    const result = await rehydrateDuel(id);
    if (result.ok) {
      ok++;
      logger.info(`[duel:rehydrate] duel ${id} rejoué (${result.replayedActions} actions)`);
    } else {
      ko++;
      logger.warn(`[duel:rehydrate] duel ${id} KO — ${result.error}`);
    }
  }
  return { total: ids.length, ok, ko };
}
