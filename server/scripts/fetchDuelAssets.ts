/**
 * Récupère les données nécessaires au moteur de duel : la base de cartes et les
 * scripts Lua de Project Ignis.
 *
 *     npx ts-node scripts/fetchDuelAssets.ts
 *
 * Ces fichiers ne sont **pas versionnés** (cf. .gitignore) : `BabelCDB` ne
 * déclare aucune licence, et les redistribuer depuis notre dépôt serait un
 * risque inutile. On les tire de la source à l'installation, comme le fait
 * EDOPro lui-même.
 *
 * Deux stratégies différentes selon la brique :
 *   - `cards.cdb` fait 7,5 Mo à lui seul dans un dépôt qui en pèse 245 : on
 *     télécharge le seul fichier utile, pas le dépôt.
 *   - Les scripts sont des milliers de petits fichiers Lua : un clone
 *     superficiel (`--depth 1`) est plus rapide qu'autant de requêtes HTTP, et
 *     il rend la mise à jour triviale (`git pull`).
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'duel');
const SCRIPTS_DIR = path.join(ASSETS_DIR, 'scripts');
const CDB_PATH = path.join(ASSETS_DIR, 'cards.cdb');

const CDB_URL =
  'https://raw.githubusercontent.com/ProjectIgnis/BabelCDB/master/cards.cdb';
const SCRIPTS_REPO = 'https://github.com/ProjectIgnis/CardScripts.git';
// strings-fr.conf : traductions des invites systeme (SELECT_OPTION, marqueurs,
// archetypes). Sans ce fichier, les invites multi-effets affichent 'Effet 1',
// 'Effet 2' au lieu du vrai texte — l'user ne sait pas quel effet il active.
const STRINGS_FR_URL =
  'https://raw.githubusercontent.com/ProjectIgnis/DeltaPuzzle/master/strings-fr.conf';
const STRINGS_FR_PATH = path.join(ASSETS_DIR, 'strings-fr.conf');

/** Un fichier SQLite commence par cette signature. Sert à détecter une page d'erreur HTML. */
const SQLITE_MAGIC = 'SQLite format 3\0';

function log(step: string, message: string): void {
  console.log(`[${step}] ${message}`);
}

function hasGit(): boolean {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

async function fetchCardDatabase(force: boolean): Promise<void> {
  if (!force && fs.existsSync(CDB_PATH)) {
    const size = fs.statSync(CDB_PATH).size;
    log('cdb', `déjà présent (${(size / 1048576).toFixed(1)} Mo) — --force pour retélécharger`);
    return;
  }

  log('cdb', `téléchargement depuis ${CDB_URL}`);
  const res = await fetch(CDB_URL);
  if (!res.ok) {
    throw new Error(`cards.cdb : HTTP ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // GitHub renvoie une page HTML en 200 sur certaines erreurs de chemin : sans
  // ce contrôle, on écrirait un fichier illisible que SQLite rejetterait bien
  // plus tard, avec un message incompréhensible.
  if (buf.subarray(0, SQLITE_MAGIC.length).toString('binary') !== SQLITE_MAGIC) {
    throw new Error(
      "cards.cdb : le fichier reçu n'est pas une base SQLite (URL changée côté BabelCDB ?)"
    );
  }

  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  fs.writeFileSync(CDB_PATH, buf);
  log('cdb', `écrit dans ${CDB_PATH} (${(buf.length / 1048576).toFixed(1)} Mo)`);
}

function fetchScripts(force: boolean): void {
  if (!hasGit()) {
    throw new Error('git est introuvable dans le PATH — requis pour récupérer les scripts');
  }

  const alreadyCloned = fs.existsSync(path.join(SCRIPTS_DIR, '.git'));

  if (alreadyCloned && !force) {
    log('scripts', 'dépôt déjà présent — mise à jour');
    const pull = spawnSync('git', ['-C', SCRIPTS_DIR, 'pull', '--ff-only', '--depth', '1'], {
      encoding: 'utf8',
      stdio: 'inherit',
    });
    if (pull.status !== 0) {
      log('scripts', 'git pull a échoué — relancer avec --force pour recloner');
    }
  } else {
    if (alreadyCloned) fs.rmSync(SCRIPTS_DIR, { recursive: true, force: true });
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    log('scripts', `clone superficiel de ${SCRIPTS_REPO}`);
    const clone = spawnSync(
      'git',
      ['clone', '--depth', '1', SCRIPTS_REPO, SCRIPTS_DIR],
      { encoding: 'utf8', stdio: 'inherit' }
    );
    if (clone.status !== 0) {
      throw new Error('git clone des scripts a échoué');
    }
  }

  // Contrôle de cohérence : le moteur charge `constant.lua` et `utility.lua` au
  // démarrage de chaque duel, et les scripts de cartes vivent dans `official/`.
  for (const required of ['constant.lua', 'utility.lua', 'official']) {
    const p = path.join(SCRIPTS_DIR, required);
    if (!fs.existsSync(p)) {
      throw new Error(`scripts : ${required} manquant après le clone — arborescence inattendue`);
    }
  }

  const officialCount = fs
    .readdirSync(path.join(SCRIPTS_DIR, 'official'))
    .filter((f) => f.endsWith('.lua')).length;
  log('scripts', `${officialCount} scripts de cartes dans official/`);
}

async function fetchStringsFr(force: boolean): Promise<void> {
  if (!force && fs.existsSync(STRINGS_FR_PATH)) {
    log('strings', `déjà présent — --force pour retélécharger`);
    return;
  }
  log('strings', `téléchargement depuis ${STRINGS_FR_URL}`);
  try {
    const res = await fetch(STRINGS_FR_URL);
    if (!res.ok) {
      log('strings', `HTTP ${res.status} — l'engine tournera avec des libellés génériques`);
      return;
    }
    const text = await res.text();
    // Garde-fou : le fichier valide commence par des commentaires ou des !system
    if (!text.includes('!system') && !text.includes('#')) {
      log('strings', 'contenu inattendu — abandon');
      return;
    }
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(STRINGS_FR_PATH, text);
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith('!system')).length;
    log('strings', `écrit dans ${STRINGS_FR_PATH} (${lines} entrées système)`);
  } catch (err) {
    log('strings', `échec (${err instanceof Error ? err.message : err}) — non bloquant`);
  }
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');

  log('init', `destination : ${ASSETS_DIR}`);
  await fetchCardDatabase(force);
  fetchScripts(force);
  await fetchStringsFr(force);
  log('init', 'assets du moteur prêts');
}

main().catch((err) => {
  console.error('[erreur]', err instanceof Error ? err.message : err);
  process.exit(1);
});
