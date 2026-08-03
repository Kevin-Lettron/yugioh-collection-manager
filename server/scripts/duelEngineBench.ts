/**
 * Étape 2 du plan moteur — vérifie le pont vers le worker et **mesure la
 * mémoire par duel actif**.
 *
 *     npx ts-node scripts/duelEngineBench.ts [nombre de duels]
 *
 * Cette mesure n'est pas décorative : c'est elle qui dira à l'étape 8 si le
 * droplet actuel tient, ou s'il faut passer au palier au-dessus. Tant qu'on ne
 * l'a pas, tout dimensionnement est une devinette.
 *
 * Le script ne touche pas à PostgreSQL : decks en dur, pour que l'échec
 * éventuel désigne le moteur.
 */

import {
  createEngineDuel,
  destroyEngineDuel,
  engineStats,
  shutdownEngine,
} from '../src/services/duelEngine/engineClient';
import { assetsInstalled, MISSING_ASSETS_HINT } from '../src/services/duelEngine/paths';
import type { EnginePlayerDeck } from '../src/services/duelEngine/protocol';

/** Même deck banal que le smoke test : 40 cartes, aucun effet complexe. */
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

const mib = (bytes: number): string => `${(bytes / 1048576).toFixed(1)} Mio`;

async function main(): Promise<void> {
  if (!assetsInstalled()) {
    console.error(MISSING_ASSETS_HINT);
    process.exit(1);
  }

  const count = Math.max(1, Number(process.argv[2]) || 5);
  const duelIds: number[] = [];

  // Première mesure : le worker démarre, charge le WASM et les 14 700 cartes,
  // mais n'a encore aucun duel. C'est le coût fixe.
  const baseline = await engineStats();
  console.log(`socle (moteur chargé, 0 duel) : rss ${mib(baseline.memory.rss)}`);
  console.log('');

  let previousRss = baseline.memory.rss;

  for (let i = 1; i <= count; i++) {
    const duelId = 900_000 + i;
    const result = await createEngineDuel({
      duelId,
      players: [DECK, DECK],
    });
    duelIds.push(duelId);

    const s = await engineStats();
    const delta = s.memory.rss - previousRss;
    previousRss = s.memory.rss;

    console.log(
      `duel ${String(i).padStart(2)} : ${result.status.padEnd(17)} ` +
        `${String(result.messages.length).padStart(3)} messages, ` +
        `${String(result.steps).padStart(3)} itérations · ` +
        `rss ${mib(s.memory.rss)} (${delta >= 0 ? '+' : ''}${mib(delta)})`
    );
  }

  const loaded = await engineStats();
  const perDuel = (loaded.memory.rss - baseline.memory.rss) / count;

  console.log('');
  console.log('--- bilan mémoire ---');
  // `process.memoryUsage()` dans un worker rend le RSS du **processus entier**,
  // fil principal compris. Sous ts-node, le compilateur TypeScript y pèse à lui
  // seul quelques centaines de mégaoctets : le socle affiché ici est très
  // au-dessus de ce que donnera le serveur compilé. Le coût **par duel**, lui,
  // est un écart entre deux mesures — il est juste dans les deux cas, et c'est
  // la seule valeur à retenir pour dimensionner.
  console.log(`  socle             : ${mib(baseline.memory.rss)}  (ts-node inclus, cf. commentaire)`);
  console.log(`  avec ${String(count).padStart(2)} duels     : ${mib(loaded.memory.rss)}`);
  console.log(`  coût par duel     : ~${mib(perDuel)}`);
  console.log(
    `  extrapolation     : 50 duels simultanés ≈ ${mib(baseline.memory.rss + perDuel * 50)}`
  );

  for (const id of duelIds) {
    await destroyEngineDuel(id);
  }

  // La libération n'est pas instantanée : le tas WebAssembly rend la mémoire à
  // l'allocateur, pas forcément au système. On mesure quand même pour repérer
  // une fuite franche.
  const after = await engineStats();
  console.log(`  après destruction : ${mib(after.memory.rss)} (${after.activeDuels} duel actif)`);

  await shutdownEngine();
}

main().catch(async (err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  await shutdownEngine().catch(() => undefined);
  process.exit(1);
});
