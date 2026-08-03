import { DatabaseSync } from 'node:sqlite';
import type { OcgCardData } from 'ocgcore-wasm';
import { CARD_DB_PATH, MISSING_ASSETS_HINT, assetsInstalled } from './paths';

/**
 * Charge `cards.cdb` et le projette dans la forme attendue par le moteur.
 *
 * Le format `.cdb` est celui de YGOPro depuis quinze ans : deux tables, `datas`
 * pour les valeurs de jeu et `texts` pour les libellés. Plusieurs champs y sont
 * **empaquetés**, et c'est là que se joue la correction du portage :
 *
 *   - `level` porte trois informations. Bits 0-7 le niveau (ou le rang, ou la
 *     valeur Lien) ; bits 16-23 l'échelle Pendule droite ; bits 24-31 la gauche.
 *   - `def` sert de champ à double usage : pour un monstre Lien, ce n'est pas
 *     une défense mais le masque des flèches.
 *   - `setcode` empile jusqu'à **quatre** archétypes de 16 bits dans un entier
 *     64 bits. Il dépasse `Number.MAX_SAFE_INTEGER` (on relève 0x1953008004110a4
 *     dans la base actuelle) : il doit être lu en `BigInt`, sinon les archétypes
 *     hauts sont silencieusement corrompus et les cartes concernées cessent de
 *     se reconnaître entre elles.
 *
 * `node:sqlite` est utilisé plutôt que `better-sqlite3` : c'est un module natif
 * intégré à Node 24, donc aucun binaire à compiler sur le VPS.
 */

/** TYPE_LINK dans ocgcore. Défini ici pour ne pas dépendre de l'ESM au chargement. */
const TYPE_LINK = 0x4000000;

export interface CardStore {
  /** Données de jeu, indexées par passcode. */
  data: Map<number, OcgCardData>;
  /** Noms anglais, pour les journaux et le débogage. */
  names: Map<number, string>;
}

/** Découpe un `setcode` 64 bits en ses archétypes de 16 bits, zéros exclus. */
export function unpackSetcodes(packed: bigint): number[] {
  const out: number[] = [];
  for (let shift = 0n; shift < 64n; shift += 16n) {
    const code = Number((packed >> shift) & 0xffffn);
    if (code !== 0) out.push(code);
  }
  return out;
}

interface DataRow {
  id: bigint;
  alias: bigint;
  setcode: bigint;
  type: bigint;
  atk: bigint;
  def: bigint;
  level: bigint;
  race: bigint;
  attribute: bigint;
}

export function rowToCardData(row: DataRow): OcgCardData {
  const type = Number(row.type);
  const level = row.level;
  const isLink = (type & TYPE_LINK) !== 0;

  return {
    code: Number(row.id),
    alias: Number(row.alias),
    setcodes: unpackSetcodes(row.setcode),
    type,
    level: Number(level & 0xffn),
    attribute: Number(row.attribute),
    race: row.race,
    // -2 encode l'ATK/DEF variable (« ? ») : on le laisse tel quel, le moteur
    // sait l'interpréter.
    attack: Number(row.atk),
    defense: isLink ? 0 : Number(row.def),
    lscale: Number((level >> 24n) & 0xffn),
    rscale: Number((level >> 16n) & 0xffn),
    link_marker: isLink ? Number(row.def) : 0,
  };
}

/**
 * Lit la base et retourne les cartes en mémoire.
 *
 * ~14 700 cartes, quelques mégaoctets une fois en objets : chargé une fois au
 * démarrage, jamais rechargé — la base ne change qu'au `fetchDuelAssets`.
 */
export function loadCardStore(dbPath: string = CARD_DB_PATH): CardStore {
  if (!assetsInstalled()) {
    throw new Error(MISSING_ASSETS_HINT);
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const dataStmt = db.prepare(
      'SELECT id, alias, setcode, type, atk, def, level, race, attribute FROM datas'
    );
    // Sans cela, `setcode` perd ses bits hauts (cf. l'en-tête).
    dataStmt.setReadBigInts(true);

    const data = new Map<number, OcgCardData>();
    for (const row of dataStmt.all() as unknown as DataRow[]) {
      const card = rowToCardData(row);
      data.set(card.code, card);
    }

    const names = new Map<number, string>();
    for (const row of db.prepare('SELECT id, name FROM texts').all() as Array<{
      id: number;
      name: string;
    }>) {
      names.set(Number(row.id), row.name);
    }

    return { data, names };
  } finally {
    db.close();
  }
}

let cached: CardStore | null = null;

/** Instance partagée — le chargement est idempotent et coûte ~200 ms. */
export function getCardStore(): CardStore {
  if (!cached) cached = loadCardStore();
  return cached;
}

/**
 * Résout un passcode vers les données de jeu réelles.
 *
 * Les illustrations alternatives ont leur propre passcode et pointent vers
 * l'original par `alias` — c'est le cas de tous les ids que YGOProDeck expose
 * pour les artworks secondaires. Sans cette résolution, une carte parfaitement
 * légitime de la collection serait refusée par le moteur.
 */
export function resolveCard(code: number, store: CardStore = getCardStore()): OcgCardData | null {
  const direct = store.data.get(code);
  if (!direct) return null;
  if (direct.alias === 0) return direct;
  return store.data.get(direct.alias) ?? direct;
}
