/**
 * Étape 1 du plan moteur — la preuve que la chaîne complète tient debout.
 *
 *     npx ts-node scripts/duelSmokeTest.ts
 *
 * Monte un duel réel : charge le moteur WebAssembly, lit `cards.cdb`, injecte
 * deux decks, démarre la partie et déroule les messages jusqu'à ce que le moteur
 * demande une décision au joueur. À ce point, tout ce qui devait fonctionner
 * fonctionne — le reste du chantier est de la traduction de messages.
 *
 * Ce script ne touche pas à PostgreSQL : le deck est écrit en dur, pour que
 * l'échec éventuel désigne le moteur et rien d'autre.
 */

import { getCore, getOcgModule, createScriptReader, BOOTSTRAP_SCRIPTS, readBootstrapScript } from '../src/services/duelEngine/engineHost';
import { getCardStore, resolveCard } from '../src/services/duelEngine/cardStore';
import { assetsInstalled, MISSING_ASSETS_HINT, DUEL_ASSETS_DIR } from '../src/services/duelEngine/paths';

/**
 * Un deck volontairement banal : que du monstre Normal et de la magie simple.
 * Aucun effet complexe, donc aucune ambiguïté sur l'origine d'un échec.
 * 40 cartes, la taille légale minimale.
 */
const MAIN_DECK: number[] = [
  ...Array<number>(3).fill(89631139), // Dragon Blanc aux Yeux Bleus
  ...Array<number>(3).fill(46986414), // Magicien Sombre
  ...Array<number>(3).fill(74677422), // Dragon Rouge aux Yeux Noirs
  ...Array<number>(3).fill(4035199), // Coureur Mystique
  ...Array<number>(3).fill(71413901), // Beaver Warrior
  ...Array<number>(3).fill(38517737), // Guerrier Silencieux LV5
  ...Array<number>(3).fill(5405694), // Dark Hole
  ...Array<number>(3).fill(53129443), // Trou Noir Gravitationnel
  ...Array<number>(3).fill(83764718), // Monster Reborn
  ...Array<number>(3).fill(97077563), // Pot de Cupidité
  ...Array<number>(2).fill(44095762), // Mirror Force
  ...Array<number>(2).fill(4206964), // Trap Hole
  ...Array<number>(2).fill(44519536), // Waboku
  ...Array<number>(2).fill(12580477), // Raigeki Break
  ...Array<number>(2).fill(70828912), // Cylindre Magique
];

async function main(): Promise<void> {
  if (!assetsInstalled()) {
    console.error(MISSING_ASSETS_HINT);
    process.exit(1);
  }
  console.log(`assets   : ${DUEL_ASSETS_DIR}`);

  const store = getCardStore();
  console.log(`cartes   : ${store.data.size} chargées depuis cards.cdb`);

  // Contrôle préalable : une carte introuvable ici produirait plus tard une
  // erreur du moteur beaucoup moins lisible.
  const missing = [...new Set(MAIN_DECK)].filter((code) => !resolveCard(code, store));
  if (missing.length) {
    console.error(`cartes introuvables dans cards.cdb : ${missing.join(', ')}`);
    process.exit(1);
  }

  const ocg = await getOcgModule();
  const lib = await getCore();
  const [major, minor] = lib.getVersion();
  console.log(`moteur   : ocgcore ${major}.${minor}`);

  const scriptReader = createScriptReader();
  let scriptsRequested = 0;

  const handle = lib.createDuel({
    flags: ocg.OcgDuelMode.MODE_MR5,
    seed: [1n, 2n, 3n, 4n],
    team1: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    team2: { drawCountPerTurn: 1, startingDrawCount: 5, startingLP: 8000 },
    cardReader: (code) => resolveCard(code, store),
    scriptReader: (name) => {
      scriptsRequested++;
      return scriptReader(name);
    },
    errorHandler: (type, text) => console.warn(`  [moteur ${type}] ${text}`),
  });

  if (!handle) throw new Error('createDuel a échoué');

  for (const name of BOOTSTRAP_SCRIPTS) {
    lib.loadScript(handle, name, readBootstrapScript(name));
  }

  for (const team of [0, 1] as const) {
    for (const code of MAIN_DECK) {
      lib.duelNewCard(handle, {
        code,
        team,
        duelist: 0,
        controller: team,
        location: ocg.OcgLocation.DECK,
        position: ocg.OcgPosition.FACEDOWN_DEFENSE,
        sequence: 0,
      });
    }
  }
  console.log(`decks    : ${MAIN_DECK.length} cartes par joueur`);

  lib.startDuel(handle);
  console.log('\n--- déroulé ---');

  const seen = new Map<string, number>();
  let steps = 0;
  let waitingFor: string | null = null;
  let lastLabel: string | null = null;

  // Garde-fou : sans réponse de joueur, le moteur ne peut pas avancer au-delà
  // de la première décision. Si la boucle dépasse ce seuil, c'est qu'elle
  // tourne à vide et il vaut mieux le dire que pendre le terminal.
  const MAX_STEPS = 500;

  while (steps++ < MAX_STEPS) {
    const status = lib.duelProcess(handle);

    for (const message of lib.duelGetMessage(handle)) {
      if (!message) continue;
      // C'est une Map, pas un objet indexable.
      const label = ocg.ocgMessageTypeStrings.get(message.type) ?? `TYPE_${message.type}`;
      seen.set(label, (seen.get(label) ?? 0) + 1);
      lastLabel = label;
    }

    if (status === ocg.OcgProcessResult.END) {
      console.log('le moteur a terminé la partie');
      break;
    }
    if (status === ocg.OcgProcessResult.CONTINUE) continue;

    // Statut « il faut une réponse » : c'est le point d'arrêt attendu. Le
    // dernier message émis est la demande elle-même.
    waitingFor = lastLabel ?? 'inconnu';
    break;
  }

  console.log('\n--- messages émis ---');
  for (const [label, count] of [...seen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)} × ${label}`);
  }

  console.log('\n--- bilan ---');
  console.log(`  scripts Lua demandés : ${scriptsRequested}`);
  console.log(`  itérations           : ${steps}`);
  console.log(`  le moteur attend une décision sur : ${waitingFor ?? '—'}`);

  lib.destroyDuel(handle);

  if (!waitingFor) {
    console.error('\nÉCHEC : le moteur n\'a jamais demandé de décision.');
    process.exit(1);
  }
  console.log('\nOK — le moteur tourne, pioche et rend la main au joueur.');
}

main().catch((err) => {
  console.error('[erreur]', err instanceof Error ? err.stack : err);
  process.exit(1);
});
