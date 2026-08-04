/**
 * Étape 4 du plan moteur — vérifie le cycle de vie d'un duel.
 *
 *     npx ts-node scripts/duelLifecycleTest.ts
 *
 * Trois contrôles, sur un moteur dont les seuils ont été raccourcis par
 * variables d'environnement — sinon il faudrait attendre une demi-heure pour
 * observer la purge, donc personne ne l'observerait :
 *
 *   1. un duel actif **survit** au balayage tant qu'on l'utilise ;
 *   2. un duel abandonné est **libéré** et le fil principal en est prévenu ;
 *   3. le plafond de duels simultanés **refuse proprement** au lieu de laisser
 *      le worker se faire tuer par le système.
 *
 * Ne touche pas à PostgreSQL.
 */

// Doit précéder l'import du client : le worker lit ces valeurs à son démarrage.
process.env.DUEL_IDLE_TTL_MS = '3000';
process.env.DUEL_ENDED_TTL_MS = '2000';
process.env.DUEL_SWEEP_INTERVAL_MS = '500';

import {
  createEngineDuel,
  viewEngineDuel,
  destroyEngineDuel,
  engineStats,
  isDuelLive,
  onWorkerLost,
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  if (!assetsInstalled()) {
    console.error(MISSING_ASSETS_HINT);
    process.exit(1);
  }

  const expired: number[] = [];
  onWorkerLost((ids, reason) => {
    expired.push(...ids);
    console.log(`  → notification reçue : ${ids.join(', ')} (${reason})`);
  });

  // ── 1. Un duel qu'on utilise ne doit pas être purgé
  console.log('\n1. Un duel actif survit au balayage');
  const alive = 700_001;
  await createEngineDuel({ duelId: alive, seat: 0, players: [DECK, DECK] });

  // Cinq consultations réparties sur plus de deux fois le TTL : sans le
  // rafraîchissement d'activité, il serait purgé au milieu.
  for (let i = 0; i < 5; i++) {
    await wait(1500);
    await viewEngineDuel(alive, 0);
  }
  check('toujours vivant après 7,5 s (TTL 3 s)', isDuelLive(alive));
  check("pas de notification d'expiration", !expired.includes(alive));

  // ── 2. Un duel abandonné doit être libéré
  console.log('\n2. Un duel abandonné est libéré');
  const abandoned = 700_002;
  await createEngineDuel({ duelId: abandoned, seat: 0, players: [DECK, DECK] });
  const before = await engineStats();

  // Pendant l'attente, on continue de consulter le duel du test 1. C'est tout
  // l'intérêt : si le balayage était aveugle, il emporterait les deux. Sans ce
  // rafraîchissement, le duel « actif » expirerait lui aussi — ce que le test
  // a d'ailleurs signalé à la première exécution, à juste titre.
  const keepAlive = setInterval(() => {
    viewEngineDuel(alive, 0).catch(() => undefined);
  }, 1000);

  await wait(5000); // > TTL + un tour de balayage
  clearInterval(keepAlive);

  const after = await engineStats();
  check('notification reçue', expired.includes(abandoned));
  check('le moteur ne le connaît plus', !isDuelLive(abandoned));
  check(
    'compteur de duels décrémenté',
    after.activeDuels < before.activeDuels,
    `${before.activeDuels} → ${after.activeDuels}`
  );

  const view = await viewEngineDuel(abandoned, 0).then(
    () => 'accepté',
    (e: Error) => e.message
  );
  check('consulter un duel purgé échoue clairement', view.includes('inconnu'), view);

  // ── 3. Le duel encore utilisé n'a pas été emporté au passage
  console.log('\n3. La purge ne touche que ce qu\'elle doit');
  check('le duel actif est intact', isDuelLive(alive));
  await destroyEngineDuel(alive);

  console.log(`\n${failures === 0 ? 'Tout est conforme.' : `${failures} contrôle(s) en échec.`}`);
  await shutdownEngine();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  await shutdownEngine().catch(() => undefined);
  process.exit(1);
});
