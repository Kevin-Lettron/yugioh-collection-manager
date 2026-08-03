/**
 * Étape 3 du plan moteur — relevé de terrain avant d'écrire la traduction.
 *
 *     npx ts-node scripts/duelAutoPlay.ts [nombre de duels]
 *
 * Fait jouer le moteur contre lui-même avec une politique naïve, et compte
 * **ce qui arrive réellement**. Le moteur définit une centaine de types de
 * messages ; en pratique une partie n'en croise qu'une fraction. Écrire la
 * traduction sans cette mesure, ce serait couvrir au hasard.
 *
 * Le script signale deux choses qui comptent plus que le reste :
 *   - les demandes que la politique ne sait pas satisfaire (elles deviendront
 *     du travail à faire) ;
 *   - les `retry`, qui sont la façon dont le moteur dit « ta réponse est
 *     invalide ». Un `retry` est toujours un bogue de notre côté.
 */

import type { OcgLocation, OcgMessage, OcgPosition, OcgResponse, SelectFieldPlace } from 'ocgcore-wasm';
import {
  createEngineDuel,
  destroyEngineDuel,
  shutdownEngine,
} from '../src/services/duelEngine/engineClient';
import { getOcgModule } from '../src/services/duelEngine/engineHost';
import { assetsInstalled, MISSING_ASSETS_HINT } from '../src/services/duelEngine/paths';
import type { EnginePlayerDeck } from '../src/services/duelEngine/protocol';

const MAIN: number[] = [
  ...Array<number>(3).fill(89631139),
  ...Array<number>(3).fill(46986414),
  ...Array<number>(3).fill(74677422),
  ...Array<number>(3).fill(4035199),
  ...Array<number>(3).fill(71413901),
  ...Array<number>(3).fill(38517737),
  ...Array<number>(3).fill(5405694),
  ...Array<number>(3).fill(53129443),
  ...Array<number>(3).fill(83764718),
  ...Array<number>(3).fill(97077563),
  ...Array<number>(2).fill(44095762),
  ...Array<number>(2).fill(4206964),
  ...Array<number>(2).fill(44519536),
  ...Array<number>(2).fill(12580477),
  ...Array<number>(2).fill(70828912),
];
const DECK: EnginePlayerDeck = { main: MAIN, extra: [] };

/** Une partie complète tient largement dedans ; au-delà, on tourne en rond. */
const MAX_DECISIONS = 4000;

type Ocg = typeof import('ocgcore-wasm');

interface Tally {
  messages: Map<string, number>;
  unsupported: Map<string, number>;
  retries: number;
  decisions: number;
  winner: number | null;
  firstRetryDump?: string;
}

/** Premier bit à 1 d'un masque de positions, sous forme de valeur de position. */
function firstPosition(mask: number): OcgPosition {
  for (const bit of [0x1, 0x2, 0x4, 0x8] as const) {
    if (mask & bit) return bit as OcgPosition;
  }
  return 0x1 as OcgPosition;
}

/**
 * Zones libres d'un masque de terrain.
 *
 * Deux conventions à connaître, et se tromper sur l'une ou l'autre fait refuser
 * la réponse par un `retry` muet :
 *
 *   1. Un bit **à 1 signifie indisponible**, pas l'inverse.
 *   2. Le masque est **relatif au joueur interrogé**. Les octets, dans l'ordre :
 *      ses monstres, ses magies/pièges, les monstres adverses, les magies/pièges
 *      adverses. Il n'y a pas de « joueur 0 » absolu là-dedans.
 *
 * Relevé sur le terrain : le moteur demande une place au joueur 1 avec le masque
 * 0xFFFFFFE0 — seuls les bits 0 à 4 sont libres. Répondre « joueur 0, zone
 * monstre 0 » est refusé ; il fallait lire « **mes** cinq zones monstre ».
 */
function freePlaces(ocg: Ocg, mask: number, player: number): SelectFieldPlace[] {
  const self = player;
  const foe = player === 0 ? 1 : 0;

  const groups: Array<[shift: number, owner: number, location: OcgLocation]> = [
    [0, self, ocg.OcgLocation.MZONE],
    [8, self, ocg.OcgLocation.SZONE],
    [16, foe, ocg.OcgLocation.MZONE],
    [24, foe, ocg.OcgLocation.SZONE],
  ];

  const out: SelectFieldPlace[] = [];
  for (const [shift, owner, location] of groups) {
    for (let seq = 0; seq < 5; seq++) {
      const unavailable = (mask >>> (shift + seq)) & 1;
      if (!unavailable) out.push({ player: owner, location, sequence: seq });
    }
  }
  return out;
}

/**
 * Politique de jeu. Volontairement bête : elle ne cherche pas à gagner, elle
 * cherche à **traverser tous les embranchements du moteur** sans se bloquer.
 */
function decide(ocg: Ocg, message: OcgMessage, tally: Tally): OcgResponse | null {
  const R = ocg.OcgResponseType;
  const M = ocg.OcgMessageType;

  switch (message.type) {
    case M.SELECT_IDLECMD: {
      const m = message;
      if (m.summons.length) {
        return { type: R.SELECT_IDLECMD, action: ocg.SelectIdleCMDAction.SELECT_SUMMON, index: 0 };
      }
      if (m.activates.length) {
        return { type: R.SELECT_IDLECMD, action: ocg.SelectIdleCMDAction.SELECT_ACTIVATE, index: 0 };
      }
      if (m.monster_sets.length) {
        return {
          type: R.SELECT_IDLECMD,
          action: ocg.SelectIdleCMDAction.SELECT_MONSTER_SET,
          index: 0,
        };
      }
      if (m.spell_sets.length) {
        return {
          type: R.SELECT_IDLECMD,
          action: ocg.SelectIdleCMDAction.SELECT_SPELL_SET,
          index: 0,
        };
      }
      if (m.to_bp) {
        return { type: R.SELECT_IDLECMD, action: ocg.SelectIdleCMDAction.TO_BP, index: null };
      }
      return { type: R.SELECT_IDLECMD, action: ocg.SelectIdleCMDAction.TO_EP, index: null };
    }

    case M.SELECT_BATTLECMD: {
      const m = message;
      if (m.attacks.length) {
        return {
          type: R.SELECT_BATTLECMD,
          action: ocg.SelectBattleCMDAction.SELECT_BATTLE,
          index: 0,
        };
      }
      if (m.to_m2) {
        return { type: R.SELECT_BATTLECMD, action: ocg.SelectBattleCMDAction.TO_M2, index: null };
      }
      return { type: R.SELECT_BATTLECMD, action: ocg.SelectBattleCMDAction.TO_EP, index: null };
    }

    case M.SELECT_CARD: {
      const m = message;
      const n = Math.max(1, m.min);
      return {
        type: R.SELECT_CARD,
        indicies: Array.from({ length: Math.min(n, m.selects.length) }, (_, i) => i),
      };
    }

    case M.SELECT_TRIBUTE: {
      const m = message;
      const n = Math.max(1, m.min);
      return {
        type: R.SELECT_TRIBUTE,
        indicies: Array.from({ length: Math.min(n, m.selects.length) }, (_, i) => i),
      };
    }

    case M.SELECT_UNSELECT_CARD:
      // Sélectionner la première proposée ; annuler si rien n'est proposé.
      return {
        type: R.SELECT_UNSELECT_CARD,
        index: message.select_cards.length ? 0 : null,
      };

    case M.SELECT_CHAIN:
      // On ne chaîne jamais, sauf obligation : chaîner au hasard rallonge les
      // parties sans rien apprendre de plus.
      return { type: R.SELECT_CHAIN, index: message.forced ? 0 : null };

    case M.SELECT_PLACE:
    case M.SELECT_DISFIELD: {
      const m = message;
      const places = freePlaces(ocg, m.field_mask, m.player).slice(0, Math.max(1, m.count));
      return message.type === M.SELECT_PLACE
        ? { type: R.SELECT_PLACE, places }
        : { type: R.SELECT_DISFIELD, places };
    }

    case M.SELECT_POSITION:
      return { type: R.SELECT_POSITION, position: firstPosition(message.positions) };

    case M.SELECT_OPTION:
      return { type: R.SELECT_OPTION, index: 0 };

    case M.SELECT_EFFECTYN:
      return { type: R.SELECT_EFFECTYN, yes: true };

    case M.SELECT_YESNO:
      return { type: R.SELECT_YESNO, yes: true };

    case M.SELECT_SUM: {
      const m = message;
      return {
        type: R.SELECT_SUM,
        indicies: Array.from({ length: m.selects.length }, (_, i) => i),
      };
    }

    case M.SORT_CARD:
    case M.SORT_CHAIN:
      // Ordre inchangé.
      return { type: R.SORT_CARD, order: null };

    case M.ROCK_PAPER_SCISSORS:
      return { type: R.ROCK_PAPER_SCISSORS, value: 1 };

    default: {
      const label = ocg.ocgMessageTypeStrings.get(message.type) ?? `type_${message.type}`;
      tally.unsupported.set(label, (tally.unsupported.get(label) ?? 0) + 1);
      return null;
    }
  }
}

/** Rend lisible un objet contenant des BigInt, que `JSON.stringify` refuse. */
const dump = (value: unknown): string =>
  JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v), 1);

async function playOne(ocg: Ocg, duelId: number, tally: Tally): Promise<void> {
  let result = await createEngineDuel({ duelId, players: [DECK, DECK] });
  let lastAsk: OcgMessage | null = null;
  let lastAnswer: OcgResponse | null = null;

  let local = 0;
  while (local++ < MAX_DECISIONS) {
    tally.decisions++;
    for (const m of result.messages) {
      const label = ocg.ocgMessageTypeStrings.get(m.type) ?? `type_${m.type}`;
      tally.messages.set(label, (tally.messages.get(label) ?? 0) + 1);
      if (m.type === ocg.OcgMessageType.RETRY) {
        tally.retries++;
        // Un retry est toujours notre faute : le moteur a refusé la réponse
        // précédente. Sans le couple (demande, réponse), c'est introuvable.
        if (!tally.firstRetryDump) {
          tally.firstRetryDump = `demande : ${dump(lastAsk)}\nréponse : ${dump(lastAnswer)}`;
        }
      }
      if (m.type === ocg.OcgMessageType.WIN) tally.winner = m.player;
    }

    if (result.status !== 'awaiting_response') return;

    const last = result.messages[result.messages.length - 1];
    if (!last) return;

    const response = decide(ocg, last, tally);
    if (!response) return; // demande non couverte : on s'arrête ici, c'est le relevé
    lastAsk = last;
    lastAnswer = response;

    result = await import('../src/services/duelEngine/engineClient').then((m) =>
      m.respondToEngine(duelId, response)
    );
  }
}

async function main(): Promise<void> {
  if (!assetsInstalled()) {
    console.error(MISSING_ASSETS_HINT);
    process.exit(1);
  }

  const games = Math.max(1, Number(process.argv[2]) || 3);
  const ocg = await getOcgModule();

  const tally: Tally = {
    messages: new Map(),
    unsupported: new Map(),
    retries: 0,
    decisions: 0,
    winner: null,
  };

  for (let i = 0; i < games; i++) {
    const duelId = 800_000 + i;
    const before = tally.decisions;
    await playOne(ocg, duelId, tally);
    console.log(
      `partie ${i + 1} : ${tally.decisions - before} décisions` +
        (tally.winner !== null ? ` · vainqueur joueur ${tally.winner}` : ' · non terminée')
    );
    await destroyEngineDuel(duelId);
    tally.winner = null;
  }

  console.log('\n--- messages rencontrés ---');
  const sorted = [...tally.messages.entries()].sort((a, b) => b[1] - a[1]);
  for (const [label, count] of sorted) {
    console.log(`  ${String(count).padStart(5)} × ${label}`);
  }
  console.log(`  (${sorted.length} types distincts)`);

  console.log('\n--- demandes non couvertes ---');
  if (tally.unsupported.size === 0) {
    console.log('  aucune');
  } else {
    for (const [label, count] of tally.unsupported) {
      console.log(`  ${String(count).padStart(5)} × ${label}`);
    }
  }

  console.log(`\nretry (réponse refusée par le moteur) : ${tally.retries}`);
  if (tally.firstRetryDump) {
    console.log(`\n--- premier refus ---\n${tally.firstRetryDump}`);
  }
  console.log(`décisions totales : ${tally.decisions}`);

  await shutdownEngine();
}

main().catch(async (err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  await shutdownEngine().catch(() => undefined);
  process.exit(1);
});
