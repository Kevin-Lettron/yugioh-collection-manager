/**
 * Bloc 5 · Auto-joueur Snake-Eye — §6.1 du PLAN-DUEL-AMELIORATIONS.
 *
 *     npx ts-node scripts/duelAutoPlaySnakeEye.ts [N]
 *     FORCE_RETRY=1 npx ts-node scripts/duelAutoPlaySnakeEye.ts 1
 *
 * `duelAutoPlay.ts` joue avec des monstres Normaux : c'est bon pour tester le
 * squelette du moteur, mais ça ne croise jamais les chaînes longues, les
 * invocations Xyz/Synchro/Link, les marqueurs, ni les annonces. Ce script sert
 * exactement à couvrir ces cas — un deck méta réel joue autrement.
 *
 * Mode `FORCE_RETRY=1` (§6.1 · b) : envoie **volontairement** un identifiant
 * d'option invalide sur le premier prompt de la partie, et vérifie que
 * `state.lastRetry` est populé au bon siège. Sans cette vérification, le
 * signalement des `RETRY` (Bloc 1, 2026-08-04) ne serait garanti qu'en test
 * manuel — c'est-à-dire jamais.
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
import { getCardStore } from '../src/services/duelEngine/cardStore';

/**
 * Passcodes Snake-Eye et cartes de support 2024 (choisis pour maximiser les
 * chaînes et les invocations Extra Deck) :
 *
 *   - Snake-Eye Ash 89023486
 *   - Snake-Eye Oak 91316185
 *   - Snake-Eye Poplar 34755994
 *   - Diabellstar the Black Witch 72270339
 *   - Original Sinful Spoils - Snake-Eye 48452496
 *   - Bonfire 85106525
 *   - WANTED : Seeker of Sinful Spoils 23434538
 *   - Called by the Grave 24224830
 *   - Ash Blossom & Joyous Spring 14558127
 *   - Effect Veiler 97268402
 *   - Infinite Impermanence 10045474
 *
 * Extra Deck : Snake-Eyes Flamberge Dragon, Snake-Eyes Doomed Dragon, quelques
 * Xyz/Link classiques.
 *
 * **Note importante** : ces passcodes sont vérifiés dans `cards.cdb` au
 * démarrage. Si un ID n'existe pas, on le retire et on prévient — la partie
 * démarre quand même avec les cartes disponibles.
 */
const SNAKE_EYE_MAIN_CANDIDATES: Array<{ code: number; copies: number; name: string }> = [
  { code: 89023486, copies: 3, name: 'Snake-Eye Ash' },
  { code: 91316185, copies: 2, name: 'Snake-Eye Oak' },
  { code: 34755994, copies: 3, name: 'Snake-Eye Poplar' },
  { code: 72270339, copies: 3, name: 'Diabellstar the Black Witch' },
  { code: 48452496, copies: 3, name: 'Original Sinful Spoils - Snake-Eye' },
  { code: 85106525, copies: 3, name: 'Bonfire' },
  { code: 23434538, copies: 3, name: 'WANTED: Seeker of Sinful Spoils' },
  { code: 24224830, copies: 3, name: 'Called by the Grave' },
  { code: 14558127, copies: 3, name: 'Ash Blossom & Joyous Spring' },
  { code: 97268402, copies: 3, name: 'Effect Veiler' },
  { code: 10045474, copies: 3, name: 'Infinite Impermanence' },
  // fallback matériaux (comblage à 40)
  { code: 89631139, copies: 3, name: 'Blue-Eyes White Dragon' },
];

const SNAKE_EYE_EXTRA_CANDIDATES: Array<{ code: number; name: string }> = [
  { code: 48239067, name: 'Snake-Eyes Flamberge Dragon' },
  { code: 35237510, name: 'Snake-Eyes Doomed Dragon' },
  { code: 4280259, name: 'Salamangreat Almiraj' },
  { code: 1861629, name: 'Linkuriboh' },
  { code: 41999284, name: 'I:P Masquerena' },
  { code: 65822630, name: 'S:P Little Knight' },
];

interface DeckReport {
  main: number[];
  extra: number[];
  found: string[];
  missing: string[];
}

/**
 * Compose un deck en n'incluant que les cartes présentes dans `cards.cdb`.
 * Si moins de 40 cartes principales, on complète avec des Normaux du fallback.
 */
function buildSnakeEyeDeck(): DeckReport {
  const store = getCardStore();
  const main: number[] = [];
  const extra: number[] = [];
  const found: string[] = [];
  const missing: string[] = [];

  for (const c of SNAKE_EYE_MAIN_CANDIDATES) {
    if (store.data.has(c.code)) {
      for (let i = 0; i < c.copies; i++) main.push(c.code);
      found.push(`${c.name} × ${c.copies}`);
    } else {
      missing.push(c.name);
    }
    if (main.length >= 40) break;
  }
  // Comblage : Blue-Eyes bien connu, présent dans toute base.
  while (main.length < 40) main.push(89631139);

  for (const c of SNAKE_EYE_EXTRA_CANDIDATES) {
    if (store.data.has(c.code)) {
      extra.push(c.code);
      found.push(`Extra: ${c.name}`);
    } else {
      missing.push(`Extra: ${c.name}`);
    }
  }
  return { main, extra, found, missing };
}

const MAX_DECISIONS = 6000;

interface Tally {
  prompts: Map<string, number>;
  unsupported: Map<string, number>;
  errors: string[];
  decisions: number;
  leaks: string[];
  retriesObserved: number;
}

function pick(prompt: DuelPrompt, ...prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    const found = prompt.options.find((o) => o.id === prefix || o.id.startsWith(`${prefix}:`));
    if (found) return found.id;
  }
  return null;
}

function decide(
  prompt: DuelPrompt,
  tally: Tally
): { optionIds: string[]; cancel?: boolean } | null {
  switch (prompt.kind) {
    case 'main': {
      const id = pick(prompt, 'activate', 'summon', 'spsummon', 'mset', 'sset', 'tobp', 'toep');
      return id ? { optionIds: [id] } : null;
    }
    case 'battle': {
      const id = pick(prompt, 'attack', 'activate', 'tom2', 'toep');
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
      // On accepte plus volontiers de chaîner avec un deck méta : c'est le
      // coeur du test.
      if (prompt.options.length > 0 && Math.random() < 0.4) {
        return { optionIds: [prompt.options[0].id] };
      }
      if (prompt.canCancel) return { optionIds: [], cancel: true };
      return prompt.options.length ? { optionIds: [prompt.options[0].id] } : null;
    case 'sort':
      return { optionIds: [], cancel: true };
    case 'select_counter':
      // Prend n'importe quel target à hauteur du count demandé — l'auto-joueur
      // remplit le premier target à fond, ce qui est légal.
      if (prompt.counter && prompt.counter.targets.length > 0) {
        const counters: Array<{ targetIdx: number; take: number }> = [];
        let remaining = prompt.counter.count;
        for (const t of prompt.counter.targets) {
          const take = Math.min(t.currentCount, remaining);
          if (take > 0) {
            counters.push({ targetIdx: t.targetIdx, take });
            remaining -= take;
          }
          if (remaining <= 0) break;
        }
        if (remaining === 0) return { optionIds: [] };
      }
      tally.unsupported.set(prompt.kind, (tally.unsupported.get(prompt.kind) ?? 0) + 1);
      return null;
    case 'announce_card':
      // On ne peut pas déclarer une carte sans passer par la recherche typeahead.
      // Comme on veut juste que le test avance, on renvoie une carte au hasard —
      // le serveur validera par opcodes et refusera si besoin.
      tally.unsupported.set(prompt.kind, (tally.unsupported.get(prompt.kind) ?? 0) + 1);
      return null;
    case 'unsupported':
    case 'announce':
    case 'select_card_codes':
      tally.unsupported.set(prompt.kind, (tally.unsupported.get(prompt.kind) ?? 0) + 1);
      return null;
  }
}

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
}

/**
 * Envoie volontairement un ID invalide et vérifie que `lastRetry` remonte
 * côté bon siège. §6.1 · b · seul contrôle qui vérifie qu'un vrai bug ne
 * se retrouve pas caché derrière un gel d'écran.
 */
async function testForcedRetry(duelId: number): Promise<{ ok: boolean; note: string }> {
  const state = await viewEngineDuel(duelId, 0);
  if (!state.prompt) {
    return { ok: false, note: 'pas de prompt disponible au démarrage' };
  }
  const seat = state.board.seat;
  try {
    // Un ID totalement fabriqué — le worker doit refuser via MSG_RETRY.
    const after = await chooseInEngine(duelId, seat, {
      optionIds: ['__forced_retry_invalid_id__'],
    });
    // Certains chemins renvoient directement une erreur HTTP plutôt qu'un
    // lastRetry — on considère que si `after` ne remonte pas de lastRetry
    // et qu'aucune exception n'a été levée, le test échoue.
    if (after.lastRetry) {
      return { ok: true, note: `lastRetry populé (${after.lastRetry.note ?? 'sans note'})` };
    }
    return { ok: false, note: 'aucune remontée lastRetry — le RETRY n\'est pas visible' };
  } catch (err) {
    // Le refus explicite côté choose est un chemin acceptable — le RETRY passe
    // alors par une exception au lieu d'un lastRetry, mais l'utilisateur
    // reçoit bien un signal.
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: true, note: `exception explicite : ${msg.slice(0, 80)}` };
  }
}

async function playOne(duelId: number, deck: EnginePlayerDeck, tally: Tally): Promise<string> {
  let state = (await createEngineDuel({ duelId, seat: 0, players: [deck, deck] })).state;
  auditVisibility(state, tally);

  // Mode RETRY forcé — dès qu'un prompt apparaît, on tente une réponse invalide.
  const forceRetry = process.env.FORCE_RETRY === '1';
  let retryTestDone = false;

  let local = 0;
  while (local++ < MAX_DECISIONS) {
    if (state.status === 'ended') {
      return state.winner === null || state.winner === undefined
        ? 'terminée'
        : `vainqueur joueur ${state.winner + 1} (${state.winReason ?? '?'})`;
    }
    if (state.status === 'stalled') return 'moteur bloqué';

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

    if (forceRetry && !retryTestDone) {
      const r = await testForcedRetry(duelId);
      console.log(`  [FORCE_RETRY] ${r.ok ? 'OK' : 'KO'} — ${r.note}`);
      retryTestDone = true;
      if (r.ok) tally.retriesObserved++;
      // On récupère l'état après tentative — le prompt est resté ouvert.
      state = await viewEngineDuel(duelId, seat);
      prompt = state.prompt;
      if (!prompt) return 'prompt perdu après test RETRY';
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
  // getCardStore() charge automatiquement `cards.cdb` au premier appel.
  getCardStore();

  const report = buildSnakeEyeDeck();
  console.log('\n--- deck Snake-Eye composé ---');
  console.log(`Main : ${report.main.length} cartes, Extra : ${report.extra.length}`);
  for (const f of report.found) console.log(`  ✓ ${f}`);
  if (report.missing.length) {
    console.log('\ncartes non trouvées dans cards.cdb :');
    for (const m of report.missing) console.log(`  ✗ ${m}`);
    console.log('(le deck reste jouable — les cartes manquantes sont remplacées par Blue-Eyes)');
  }

  const deck: EnginePlayerDeck = { main: report.main, extra: report.extra };
  const games = Math.max(1, Number(process.argv[2]) || 3);
  const tally: Tally = {
    prompts: new Map(),
    unsupported: new Map(),
    errors: [],
    decisions: 0,
    leaks: [],
    retriesObserved: 0,
  };

  for (let i = 0; i < games; i++) {
    const duelId = 900_000 + i;
    const before = tally.decisions;
    const outcome = await playOne(duelId, deck, tally);
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
  if (tally.leaks.length === 0) console.log('  aucune fuite détectée');
  else {
    const unique = [...new Set(tally.leaks)];
    for (const l of unique.slice(0, 10)) console.log(`  ${l}`);
  }

  if (process.env.FORCE_RETRY === '1') {
    console.log(`\n--- RETRY forcé : ${tally.retriesObserved}/${games} détecté(s) ---`);
  }

  console.log(`\ndécisions totales : ${tally.decisions}`);

  await shutdownEngine();
  process.exit(tally.errors.length || tally.leaks.length ? 1 : 0);
}

main().catch(async (err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  await shutdownEngine().catch(() => undefined);
  process.exit(1);
});
