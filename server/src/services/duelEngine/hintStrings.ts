import fs from 'fs';
import path from 'path';
import { DUEL_ASSETS_DIR } from './paths';
import logger from '../../utils/logger';

/**
 * Textes d'EDOPro — invites de sélection, libellés d'effets, marqueurs.
 *
 * Le moteur ygopro-core ne connaît pas ces textes : il envoie des identifiants
 * (par exemple `hint = 1234` sur `MSG_HINT · SELECTMSG`) que le client d'EDOPro
 * résout via `strings.conf`. Sans lui, on affichait « Effet 1 » et « Effet 2 »
 * au lieu du texte réel, ce qui rend les cartes multi-effets injouables.
 *
 * Le fichier a trois formats de ligne utiles :
 *
 *     !system 1234 texte du système
 *     !victory 1 message de victoire
 *     !counter 0x1a Marqueur X
 *     !setname 0x99 Nom d'archétype
 *
 * On charge tout au démarrage — 3 000 à 5 000 lignes, moins de 200 Ko en
 * mémoire, un seul passage. Le fichier peut être absent : on l'accepte
 * silencieusement et on retombe sur les libellés génériques.
 *
 * Deux sources connues :
 *   - https://github.com/edo9300/edopro-strings  (multilingue)
 *   - https://github.com/ProjectIgnis/DeltaPuzzle (contient une version FR)
 *
 * Localisation par défaut : `assets/duel/strings.conf`. Priorité à la version
 * française si présente (`strings-fr.conf`), sinon anglais.
 */

interface HintTables {
  /** `!system N` — utilisé partout, notamment par `MSG_HINT`. */
  system: Map<number, string>;
  /** `!victory N` — description d'une condition de victoire par effet. */
  victory: Map<number, string>;
  /** `!counter N` — nom lisible d'un marqueur. */
  counter: Map<number, string>;
  /** `!setname N` — nom d'archétype (Snake-Eye, Kashtira, etc.). */
  setname: Map<number, string>;
}

const EMPTY: HintTables = {
  system: new Map(),
  victory: new Map(),
  counter: new Map(),
  setname: new Map(),
};

let tables: HintTables = EMPTY;
let loaded = false;

/**
 * Cherche la première variante lisible, dans l'ordre : FR d'abord, EN ensuite.
 *
 * L'ordre est délibéré : nos joueurs francophones lisent mieux « Choisissez
 * une carte à défausser » que « Discard a card ». En absence des deux, on
 * tourne sans hint spécifique, qui est le comportement d'avant cette section.
 */
function findConfPath(): string | null {
  const candidates = [
    process.env.DUEL_STRINGS_FILE,
    path.join(DUEL_ASSETS_DIR, 'strings-fr.conf'),
    path.join(DUEL_ASSETS_DIR, 'strings.conf'),
    path.join(DUEL_ASSETS_DIR, 'strings-en.conf'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Parse le fichier `strings.conf`.
 *
 * Format volontairement tolérant : on ignore les lignes vides, les commentaires
 * (`#`) et tout ce qui ne commence pas par `!`. La casse compte pour la
 * commande (`!system`, minuscules), pas pour le hex qui suit.
 */
function parseConf(text: string): HintTables {
  const out: HintTables = {
    system: new Map(),
    victory: new Map(),
    counter: new Map(),
    setname: new Map(),
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.startsWith('!')) continue;

    // Sépare la commande, la clé, puis le reste (qui peut contenir des espaces).
    const spaceA = line.indexOf(' ');
    if (spaceA < 0) continue;
    const cmd = line.slice(1, spaceA);
    const rest1 = line.slice(spaceA + 1).trimStart();
    const spaceB = rest1.indexOf(' ');
    if (spaceB < 0) continue;
    const rawKey = rest1.slice(0, spaceB);
    const value = rest1.slice(spaceB + 1).trim();
    if (!value) continue;

    const key = rawKey.startsWith('0x') ? parseInt(rawKey.slice(2), 16) : parseInt(rawKey, 10);
    if (!Number.isFinite(key)) continue;

    switch (cmd) {
      case 'system':
        out.system.set(key, value);
        break;
      case 'victory':
        out.victory.set(key, value);
        break;
      case 'counter':
        out.counter.set(key, value);
        break;
      case 'setname':
        out.setname.set(key, value);
        break;
    }
  }
  return out;
}

/**
 * Charge `strings.conf` en mémoire. À appeler au démarrage du serveur.
 *
 * Idempotent : le second appel ne fait rien. Un échec de lecture est
 * journalisé mais n'empêche pas le serveur de démarrer — la partie devient
 * jouable avec des libellés génériques, ce qui reste bien meilleur qu'un
 * refus de service.
 */
export function loadHintStrings(): void {
  if (loaded) return;
  loaded = true;

  const confPath = findConfPath();
  if (!confPath) {
    logger.warn(
      '[DUEL_HINTS] strings.conf introuvable — les invites afficheront des libellés génériques'
    );
    return;
  }

  try {
    const text = fs.readFileSync(confPath, 'utf8');
    tables = parseConf(text);
    logger.info(
      `[DUEL_HINTS] ${tables.system.size} systèmes, ${tables.counter.size} marqueurs, ${tables.setname.size} archétypes chargés depuis ${path.basename(confPath)}`
    );
  } catch (err) {
    logger.error(
      `[DUEL_HINTS] échec de lecture de ${confPath} : ${err instanceof Error ? err.message : err}`
    );
  }
}

/**
 * Texte d'invite système, par ID.
 *
 * Renvoie `undefined` si l'ID n'a pas de traduction — l'appelant fait alors
 * son libellé générique. Certains IDs sortent la moitié inférieure d'un
 * entier 64 bits ; on tente aussi le repli tronqué à 32 bits, comme le
 * client EDOPro.
 */
export function systemString(id: number | bigint): string | undefined {
  const n = typeof id === 'bigint' ? Number(id & 0xffffffffn) : id;
  return tables.system.get(n) ?? tables.system.get(Number(id));
}

export function victoryString(id: number): string | undefined {
  return tables.victory.get(id);
}

export function counterString(id: number): string | undefined {
  return tables.counter.get(id);
}

export function setnameString(id: number): string | undefined {
  return tables.setname.get(id);
}

/**
 * Résout un `hint` de `SELECT_OPTION`.
 *
 * Le moteur transmet `options: bigint[]`, chaque entier étant l'ID d'un texte
 * système. On rend le libellé, ou `Effet N` en fallback. Le n° est celui
 * proposé au joueur, pas le rang du bit dans l'entier.
 */
export function optionLabel(optionId: bigint, fallbackIndex: number): string {
  const s = systemString(optionId);
  if (s) return s;
  return `Effet ${fallbackIndex + 1}`;
}
