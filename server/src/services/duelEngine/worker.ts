import { parentPort } from 'worker_threads';
import type { OcgCoreSync } from 'ocgcore-wasm';
import type { DuelSeat, DuelStateResponse } from '../../../../shared/duelView';
import {
  getCore,
  getOcgModule,
  createScriptReader,
  BOOTSTRAP_SCRIPTS,
  readBootstrapScript,
} from './engineHost';
import { getCardStore, resolveCard, type CardStore } from './cardStore';
import { DuelSession } from './session';
import type {
  EngineRequest,
  EngineResponse,
  EngineStats,
  EnginePlayerDeck,
} from './protocol';

/**
 * Worker qui héberge le moteur de duel.
 *
 * Pourquoi un fil séparé : `duelProcess` est du calcul **synchrone**. Exécuté
 * dans la boucle d'événements de Node, il gèle toute l'API le temps de résoudre
 * une chaîne — et une chaîne compliquée, ce n'est pas une microseconde. Ici, il
 * ne gèle que lui-même.
 *
 * Le worker ne parle jamais à PostgreSQL : il reçoit des passcodes et renvoie
 * des vues déjà filtrées. Toute la logique métier reste dans le fil principal.
 */

if (!parentPort) {
  throw new Error('duelEngine/worker doit être lancé comme worker_thread');
}
const port = parentPort;

const sessions = new Map<number, DuelSession>();

let core: OcgCoreSync | null = null;
let ocg: typeof import('ocgcore-wasm') | null = null;
let store: CardStore | null = null;
const scriptReader = createScriptReader();

/**
 * Garde-fou de boucle. Une partie normale enchaîne quelques dizaines
 * d'itérations entre deux décisions ; au-delà, c'est que le moteur tourne à
 * vide, et une boucle infinie dans un worker est indétectable de l'extérieur.
 */
const MAX_STEPS_PER_TURN = 10_000;

/**
 * Durée d'inactivité au-delà de laquelle un duel est libéré.
 *
 * Le moteur n'a pas de ramasse-miettes : un duel abandonné — onglet fermé,
 * joueur parti déjeuner, réseau coupé — garde son tas WebAssembly jusqu'au
 * redémarrage du worker. Sans cette purge, la mémoire ne fait que monter.
 *
 * 30 minutes : assez pour une pause, trop court pour qu'un duel oublié survive
 * la journée.
 *
 * Les trois seuils sont surchargeables par variable d'environnement. Ce n'est
 * pas de la configuration pour la configuration : sans cela, vérifier la purge
 * demanderait d'attendre une demi-heure, donc personne ne la vérifierait.
 */
const num = (name: string, fallback: number): number => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const IDLE_TTL_MS = num('DUEL_IDLE_TTL_MS', 30 * 60 * 1000);

/** Une partie terminée n'a plus rien à faire en mémoire, on la garde moins longtemps. */
const ENDED_TTL_MS = num('DUEL_ENDED_TTL_MS', 5 * 60 * 1000);

const SWEEP_INTERVAL_MS = num('DUEL_SWEEP_INTERVAL_MS', 60 * 1000);

/**
 * Plafond de duels simultanés.
 *
 * Mesuré à l'étape 2 : ~2,3 Mio par duel actif. 200 duels font donc environ
 * 460 Mio de tas — au-delà, on préfère refuser proprement plutôt que laisser
 * le worker se faire tuer par le système, ce qui emporterait **toutes** les
 * parties en cours et pas seulement celle de trop.
 */
const MAX_CONCURRENT_DUELS = 200;

async function ensureReady(): Promise<{
  core: OcgCoreSync;
  ocg: typeof import('ocgcore-wasm');
  store: CardStore;
}> {
  if (!core || !ocg || !store) {
    ocg = await getOcgModule();
    core = await getCore();
    store = getCardStore();
  }
  return { core, ocg, store };
}

/**
 * Générateur pseudo-aléatoire déterministe (xorshift128), amorcé par la graine
 * du duel. Deux duels de même graine donnent le même mélange — c'est ce qui
 * rend une partie rejouable.
 */
function makeRng(seed: readonly bigint[]): () => number {
  let x = Number(BigInt.asUintN(32, seed[0] ?? 1n)) || 1;
  let y = Number(BigInt.asUintN(32, seed[1] ?? 2n)) || 2;
  let z = Number(BigInt.asUintN(32, seed[2] ?? 3n)) || 3;
  let w = Number(BigInt.asUintN(32, seed[3] ?? 4n)) || 4;

  return () => {
    const t = x ^ (x << 11);
    x = y;
    y = z;
    z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return (w >>> 0) / 0x100000000;
  };
}

/**
 * Mélange le Main Deck **avant** de le donner au moteur.
 *
 * Mesuré, et contre-intuitif : `OCG_StartDuel` **ne mélange pas**. Le moteur
 * pioche dans l'ordre d'insertion — quatre graines différentes donnaient la
 * même main d'ouverture, à savoir la fin de la liste. C'est à l'hôte de
 * mélanger, comme le fait le serveur d'EDOPro.
 *
 * Sans ça, chaque duel se jouerait avec le deck dans l'ordre de la base de
 * données. L'Extra Deck n'est pas concerné : on n'y pioche pas.
 */
function shuffled(cards: readonly number[], rng: () => number): number[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createSession(req: Extract<EngineRequest, { type: 'create' }>): DuelStateResponse {
  const lib = core!;
  const mod = ocg!;
  const cards = store!;

  if (sessions.has(req.duelId)) destroySession(req.duelId);

  if (sessions.size >= MAX_CONCURRENT_DUELS) {
    throw new Error(
      `Le serveur héberge déjà ${sessions.size} duels — réessaie dans un moment`
    );
  }

  const handle = lib.createDuel({
    flags: mod.OcgDuelMode.MODE_MR5,
    seed: req.seed,
    team1: {
      drawCountPerTurn: req.drawCountPerTurn,
      startingDrawCount: req.startingDrawCount,
      startingLP: req.startingLP,
    },
    team2: {
      drawCountPerTurn: req.drawCountPerTurn,
      startingDrawCount: req.startingDrawCount,
      startingLP: req.startingLP,
    },
    cardReader: (code) => resolveCard(code, cards),
    scriptReader,
    errorHandler: (type, text) => {
      port.postMessage({ id: 0, notice: 'engine_error', detail: `${type}: ${text}` });
    },
  });

  if (!handle) throw new Error('createDuel a échoué');

  // Ces deux scripts ne passent pas par `scriptReader` : c'est à l'hôte de les
  // injecter, sinon le premier script de carte échoue sur des constantes
  // indéfinies.
  for (const name of BOOTSTRAP_SCRIPTS) {
    lib.loadScript(handle, name, readBootstrapScript(name));
  }

  // Un seul générateur pour les deux decks : les mélanges sont indépendants
  // mais l'ensemble reste reproductible à partir de la graine.
  const rng = makeRng(req.seed);

  const addDeck = (team: 0 | 1, deck: EnginePlayerDeck): void => {
    for (const code of shuffled(deck.main, rng)) {
      lib.duelNewCard(handle, {
        code,
        team,
        duelist: 0,
        controller: team,
        location: mod.OcgLocation.DECK,
        position: mod.OcgPosition.FACEDOWN_DEFENSE,
        sequence: 0,
      });
    }
    for (const code of deck.extra) {
      lib.duelNewCard(handle, {
        code,
        team,
        duelist: 0,
        controller: team,
        location: mod.OcgLocation.EXTRA,
        position: mod.OcgPosition.FACEDOWN_DEFENSE,
        sequence: 0,
      });
    }
  };

  addDeck(0, req.players[0]);
  addDeck(1, req.players[1]);

  const session = new DuelSession(handle, req.startingLP);
  sessions.set(req.duelId, session);

  lib.startDuel(handle);
  session.pump(lib, mod, cards, MAX_STEPS_PER_TURN);

  return session.view(lib, mod, req.duelId, req.seat, cards);
}

function destroySession(duelId: number): null {
  const session = sessions.get(duelId);
  if (!session) return null;
  // Sans ça, le tas WebAssembly ne se libère jamais : le moteur n'a pas de
  // ramasse-miettes, c'est l'hôte qui possède le duel.
  core!.destroyDuel(session.handle);
  sessions.delete(duelId);
  return null;
}

function requireSession(duelId: number): DuelSession {
  const session = sessions.get(duelId);
  if (!session) throw new Error(`duel ${duelId} inconnu du moteur`);
  return session;
}

/**
 * Libère les duels inactifs.
 *
 * Le fil principal est prévenu pour qu'il puisse annuler ces duels en base et
 * avertir les joueurs — sinon ils resteraient « actifs » à l'écran alors que
 * le moteur ne les connaît plus.
 */
function sweepIdleSessions(): void {
  const now = Date.now();
  const expired: number[] = [];

  for (const [duelId, session] of sessions) {
    const ttl = session.ended ? ENDED_TTL_MS : IDLE_TTL_MS;
    if (now - session.lastActivityAt > ttl) expired.push(duelId);
  }

  if (!expired.length) return;
  for (const duelId of expired) destroySession(duelId);
  port.postMessage({ id: 0, notice: 'duels_expired', duelIds: expired });
}

function stats(): EngineStats {
  const m = process.memoryUsage();
  return {
    activeDuels: sessions.size,
    memory: {
      rss: m.rss,
      heapUsed: m.heapUsed,
      external: m.external,
      arrayBuffers: m.arrayBuffers,
    },
  };
}

async function handle(req: EngineRequest): Promise<EngineResponse> {
  try {
    const { core: lib, ocg: mod, store: cards } = await ensureReady();

    switch (req.type) {
      case 'create':
        return { id: req.id, ok: true, result: createSession(req) };

      case 'choose': {
        const session = requireSession(req.duelId);
        session.touch();
        session.applyChoice(lib, mod, req.seat as DuelSeat, req.choice, cards);
        session.pump(lib, mod, cards, MAX_STEPS_PER_TURN);
        return {
          id: req.id,
          ok: true,
          result: session.view(lib, mod, req.duelId, req.seat as DuelSeat, cards),
        };
      }

      case 'view': {
        const session = requireSession(req.duelId);
        // Consulter compte comme une activité : un joueur qui regarde son
        // plateau en attendant l'adversaire ne doit pas voir son duel purgé.
        session.touch();
        return {
          id: req.id,
          ok: true,
          result: session.view(lib, mod, req.duelId, req.seat as DuelSeat, cards),
        };
      }

      case 'destroy':
        return { id: req.id, ok: true, result: destroySession(req.duelId) };

      case 'stats':
        return { id: req.id, ok: true, result: stats() };
    }
  } catch (err) {
    return {
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Balayage des duels abandonnes.  : ce minuteur ne doit pas empecher
// le worker de s'arreter quand on le termine.
setInterval(sweepIdleSessions, SWEEP_INTERVAL_MS).unref();

port.on('message', (req: EngineRequest) => {
  handle(req).then((res) => port.postMessage(res));
});

// Le moteur met ~1 s à s'initialiser (WASM + 14 700 cartes). On prévient le fil
// principal quand c'est prêt pour qu'il n'attende pas la première requête pour
// découvrir un problème d'installation.
ensureReady().then(
  () => port.postMessage({ id: 0, notice: 'ready' }),
  (err: unknown) =>
    port.postMessage({
      id: 0,
      notice: 'engine_error',
      detail: err instanceof Error ? err.message : String(err),
    })
);
