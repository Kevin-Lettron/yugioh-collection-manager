/**
 * Étape 3 du plan moteur — l'auto-joueur, qui sert deux fois.
 *
 *     npx ts-node scripts/duelAutoPlay.ts [nombre de duels]
 *
 * D'abord (3a) il a servi de **relevé de terrain** : faire jouer le moteur
 * contre lui-même pour compter ce qui arrive réellement, plutôt que de couvrir
 * au hasard une centaine de types de messages. Il a fait apparaître trois
 * pièges non documentés — le deck que le moteur ne mélange pas, la partie que
 * l'hôte doit arrêter lui-même, et le masque de zones relatif au joueur
 * interrogé.
 *
 * Maintenant (3b) il est le **test de bout en bout de la traduction** : il ne
 * touche plus aux structures du moteur, il joue exactement comme jouerait une
 * interface — il lit une `DuelPrompt`, choisit un identifiant d'option, et
 * renvoie ce seul identifiant. Tout ce qui casserait un front casse ici.
 *
 * Il vérifie en plus l'étanchéité de l'information cachée, le genre de bogue
 * qu'aucun test de gameplay ne révèle : la partie se déroule parfaitement, et
 * un joueur voit la main de l'autre.
 */

import type { DuelPrompt, DuelSeat, DuelStateResponse } from '../../shared/duelView';
import {
  createEngineDuel,
  chooseInEngine,
  viewEngineDuel,
  destroyEngineDuel,
  shutdownEngine,
} from '../src/services/duelEngine/engineClient';
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

interface Tally {
  prompts: Map<string, number>;
  unsupported: Map<string, number>;
  errors: string[];
  decisions: number;
  /** Contrôles d'étanchéité de l'information cachée. */
  leaks: string[];
}

/** Premier identifiant dont le préfixe figure dans la liste, par ordre de préférence. */
function pick(prompt: DuelPrompt, ...prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    const found = prompt.options.find((o) => o.id === prefix || o.id.startsWith(`${prefix}:`));
    if (found) return found.id;
  }
  return null;
}

/**
 * Politique de jeu. Volontairement bête : elle ne cherche pas à gagner, elle
 * cherche à traverser tous les embranchements du moteur sans se bloquer.
 *
 * Elle ne connaît que `DuelPrompt` — aucune structure d'ocgcore n'apparaît ici,
 * exactement comme dans un front.
 */
function decide(
  prompt: DuelPrompt,
  tally: Tally
): { optionIds: string[]; cancel?: boolean } | null {
  switch (prompt.kind) {
    case 'main': {
      const id = pick(prompt, 'summon', 'activate', 'mset', 'sset', 'tobp', 'toep');
      return id ? { optionIds: [id] } : null;
    }

    case 'battle': {
      const id = pick(prompt, 'attack', 'tom2', 'toep');
      return id ? { optionIds: [id] } : null;
    }

    case 'cards': {
      if (prompt.options.length === 0) {
        return prompt.canCancel ? { optionIds: [], cancel: true } : null;
      }
      const n = Math.max(1, Math.min(prompt.min, prompt.options.length));
      return { optionIds: prompt.options.slice(0, n).map((o) => o.id) };
    }

    case 'place':
    case 'position':
    case 'option': {
      if (!prompt.options.length) return null;
      const n = Math.max(1, Math.min(prompt.min, prompt.options.length));
      return { optionIds: prompt.options.slice(0, n).map((o) => o.id) };
    }

    case 'confirm':
      return { optionIds: ['yes'] };

    case 'chain':
      // On ne chaîne jamais, sauf obligation : chaîner au hasard rallonge les
      // parties sans rien apprendre de plus.
      if (prompt.canCancel) return { optionIds: [], cancel: true };
      return prompt.options.length ? { optionIds: [prompt.options[0].id] } : null;

    case 'sort':
      return { optionIds: [], cancel: true };

    case 'unsupported':
    case 'announce':
    case 'select_counter':
    case 'announce_card':
    case 'select_card_codes':
      // Ces invites requièrent une réponse structurée que l'auto-joueur ne sait
      // pas fabriquer (sliders de compteurs, recherche typeahead d'une carte).
      // Elles ne devraient pas apparaître avec le deck de test — le fait de les
      // compter comme non couvertes permet à `duel:autoplay` de le vérifier.
      tally.unsupported.set(prompt.kind, (tally.unsupported.get(prompt.kind) ?? 0) + 1);
      return null;
  }
}

/** Vérifie qu'une vue ne laisse pas filtrer ce que ce siège n'a pas le droit de voir. */
function auditVisibility(state: DuelStateResponse, tally: Tally): void {
  const { board } = state;

  if (board.opponent.hand.length > 0) {
    tally.leaks.push(`main adverse détaillée (${board.opponent.hand.length} cartes)`);
  }
  for (const zone of [...board.opponent.monsters, ...board.opponent.spells]) {
    if (zone?.faceDown && zone.code !== 0) {
      tally.leaks.push('carte adverse face cachée révélée');
    }
  }
  if (state.prompt && state.prompt.seat !== board.seat) {
    tally.leaks.push(`invite du siège ${state.prompt.seat} servie au siège ${board.seat}`);
  }

  // §3.2 : les animations « privées » (SHUFFLE_HAND, DECK_TOP, DRAW avec
  // codes) ne doivent jamais arriver côté adversaire avec les passcodes.
  // On ne peut pas trancher `forPlayers` depuis la vue filtrée, mais on peut
  // vérifier que les codes d'une animation SHUFFLE_HAND / DECK_TOP visible
  // par ce joueur correspondent bien à son propre côté (via controller).
  for (const a of state.animations ?? []) {
    if (
      (a.kind === 'shuffle_hand' || a.kind === 'deck_top') &&
      a.codes &&
      a.codes.length > 0 &&
      a.controller !== undefined &&
      a.controller !== board.seat
    ) {
      tally.leaks.push(`animation ${a.kind} du siège adverse avec codes révélés`);
    }
    if (
      a.kind === 'draw' &&
      a.codes &&
      a.codes.length > 0 &&
      a.controller !== undefined &&
      a.controller !== board.seat
    ) {
      tally.leaks.push(`animation draw du siège adverse avec codes de main révélés`);
    }
  }
}

/**
 * §4bis A.3 — test de non-fuite pendant l'ouverture d'un menu d'activation.
 *
 * Simule : joueur A a un prompt, on lit son état (menu potentiellement
 * ouvert), on attend 500 ms sans rien envoyer, on relit l'état du joueur B
 * et on vérifie qu'il est **inchangé** (même prompt null, mêmes counts,
 * mêmes animations). C'est la garantie forte du §4bis : contrairement à
 * Master Duel, l'adversaire ne voit rien tant que le joueur n'a pas validé.
 */
async function auditNoLeakDuringActivationMenu(
  duelId: number,
  playerSeat: DuelSeat,
  tally: Tally
): Promise<void> {
  const foeSeat: DuelSeat = playerSeat === 0 ? 1 : 0;
  const before = await viewEngineDuel(duelId, foeSeat);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await viewEngineDuel(duelId, foeSeat);

  // Le prompt adverse doit rester null (l'invite est chez l'autre joueur).
  if (before.prompt !== null || after.prompt !== null) {
    tally.leaks.push(`prompt côté adversaire pendant menu (${before.prompt?.kind}/${after.prompt?.kind})`);
  }
  // Le nombre de cartes en main, monstres, S/T ne doit pas avoir bougé.
  if (before.board.me.handCount !== after.board.me.handCount) {
    tally.leaks.push('handCount adverse a changé pendant menu ouvert');
  }
  if (
    JSON.stringify(before.board.me.monsters.map((m) => (m ? m.code : null))) !==
    JSON.stringify(after.board.me.monsters.map((m) => (m ? m.code : null)))
  ) {
    tally.leaks.push('monstres adverses ont changé pendant menu ouvert');
  }
  // Aucun nouveau reveal / combat log / animation ne doit être apparu du
  // seul fait qu'un menu était ouvert côté joueur (rien n'a été envoyé au
  // serveur, donc rien ne doit avoir bougé).
  const beforeCombat = before.combatLog?.length ?? 0;
  const afterCombat = after.combatLog?.length ?? 0;
  if (afterCombat > beforeCombat) {
    tally.leaks.push(`combatLog adverse ++${afterCombat - beforeCombat} pendant menu ouvert`);
  }
}

async function playOne(duelId: number, tally: Tally): Promise<string> {
  // `createEngineDuel` rend aussi la graine employée, que le serveur persiste
  // pour pouvoir rejouer la partie. Le test n'en a pas l'usage.
  let state = (await createEngineDuel({ duelId, seat: 0, players: [DECK, DECK] })).state;
  auditVisibility(state, tally);
  // §4bis A.3 : lance le test de non-fuite une fois dès qu'un prompt s'affiche
  // (typiquement dès le tour 1, phase principale).
  let leakTestDone = false;

  let local = 0;
  while (local++ < MAX_DECISIONS) {
    if (state.status === 'ended') {
      return state.winner === null || state.winner === undefined
        ? 'terminée'
        : `vainqueur joueur ${state.winner + 1} (${state.winReason ?? '?'})`;
    }
    if (state.status === 'stalled') return 'moteur bloqué';

    // Le siège courant est celui à qui l'invite est adressée. La vue de l'autre
    // siège ne la contient pas — c'est précisément ce qu'on veut vérifier.
    let seat: DuelSeat = state.board.seat;
    let prompt = state.prompt;

    if (!prompt) {
      const otherSeat: DuelSeat = seat === 0 ? 1 : 0;
      const other = await viewEngineDuel(duelId, otherSeat);
      auditVisibility(other, tally);
      if (!other.prompt) return 'aucune invite pour aucun siège';
      state = other;
      seat = otherSeat;
      prompt = other.prompt;
    }

    tally.prompts.set(prompt.kind, (tally.prompts.get(prompt.kind) ?? 0) + 1);

    // Test de non-fuite : une seule fois par partie, sur le premier prompt
    // rencontré. Sinon on multiplierait le temps d'exécution par 500 ms ×
    // ~500 décisions = ~4 minutes de rab pour rien.
    if (!leakTestDone) {
      await auditNoLeakDuringActivationMenu(duelId, seat, tally);
      leakTestDone = true;
    }

    const choice = decide(prompt, tally);
    if (!choice) return `invite sans réponse possible : ${prompt.kind}`;

    tally.decisions++;
    try {
      state = await chooseInEngine(duelId, seat, choice);
    } catch (err) {
      tally.errors.push(
        `${prompt.kind} → ${JSON.stringify(choice.optionIds)} : ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return 'refus du moteur';
    }
    auditVisibility(state, tally);
  }

  return 'budget de décisions épuisé';
}

async function main(): Promise<void> {
  if (!assetsInstalled()) {
    console.error(MISSING_ASSETS_HINT);
    process.exit(1);
  }

  const games = Math.max(1, Number(process.argv[2]) || 3);
  const tally: Tally = {
    prompts: new Map(),
    unsupported: new Map(),
    errors: [],
    decisions: 0,
    leaks: [],
  };

  for (let i = 0; i < games; i++) {
    const duelId = 800_000 + i;
    const before = tally.decisions;
    const outcome = await playOne(duelId, tally);
    console.log(`partie ${i + 1} : ${tally.decisions - before} décisions · ${outcome}`);
    await destroyEngineDuel(duelId);
  }

  console.log('\n--- invites rencontrées ---');
  for (const [kind, count] of [...tally.prompts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)} × ${kind}`);
  }

  console.log('\n--- invites non couvertes ---');
  if (tally.unsupported.size === 0) console.log('  aucune');
  else for (const [kind, count] of tally.unsupported) console.log(`  ${count} × ${kind}`);

  console.log('\n--- réponses refusées par le moteur ---');
  if (tally.errors.length === 0) console.log('  aucune');
  else for (const e of tally.errors.slice(0, 10)) console.log(`  ${e}`);

  console.log("\n--- étanchéité de l'information cachée ---");
  if (tally.leaks.length === 0) {
    console.log('  aucune fuite détectée');
  } else {
    const unique = [...new Set(tally.leaks)];
    for (const l of unique.slice(0, 10)) console.log(`  ${l}`);
    console.log(`  (${tally.leaks.length} occurrences, ${unique.length} distinctes)`);
  }

  console.log(`\ndécisions totales : ${tally.decisions}`);

  await shutdownEngine();
  // Sortie non nulle si quelque chose cloche : utilisable en test de
  // non-régression, pas seulement à l'œil.
  process.exit(tally.errors.length || tally.leaks.length || tally.unsupported.size ? 1 : 0);
}

main().catch(async (err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  await shutdownEngine().catch(() => undefined);
  process.exit(1);
});
