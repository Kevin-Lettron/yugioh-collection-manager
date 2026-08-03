import { parentPort } from 'worker_threads';
import type { OcgCoreSync, OcgDuelHandle, OcgMessage } from 'ocgcore-wasm';
import {
  getCore,
  getOcgModule,
  createScriptReader,
  BOOTSTRAP_SCRIPTS,
  readBootstrapScript,
} from './engineHost';
import { getCardStore, resolveCard, type CardStore } from './cardStore';
import type {
  EngineRequest,
  EngineResponse,
  EngineStats,
  EngineTurnResult,
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
 * des messages. Toute la logique métier reste dans le fil principal.
 */

if (!parentPort) {
  throw new Error('duelEngine/worker doit être lancé comme worker_thread');
}
const port = parentPort;

interface Session {
  handle: OcgDuelHandle;
  createdAt: number;
}

const sessions = new Map<number, Session>();

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
 * Déroule le moteur jusqu'à ce qu'il réclame une décision ou termine la partie.
 *
 * `duelGetMessage` doit être appelé **à chaque tour de boucle** et pas seulement
 * à la fin : le moteur vide sa file interne, et ce qui n'est pas relevé est
 * perdu.
 */
function pump(lib: OcgCoreSync, mod: typeof import('ocgcore-wasm'), duelId: number): EngineTurnResult {
  const session = sessions.get(duelId);
  if (!session) throw new Error(`duel ${duelId} inconnu du moteur`);

  const messages: OcgMessage[] = [];
  let steps = 0;

  while (steps++ < MAX_STEPS_PER_TURN) {
    const status = lib.duelProcess(session.handle);

    let won = false;
    for (const message of lib.duelGetMessage(session.handle)) {
      if (!message) continue;
      messages.push(message);
      if (message.type === mod.OcgMessageType.WIN) won = true;
    }

    // C'est **l'hôte** qui arrête la partie, pas le moteur.
    //
    // Mesuré : le moteur émet `win` — ici sur un deck-out — puis redemande une
    // décision comme si de rien n'était. Sans cette coupure, une partie gagnée
    // continue : le relevé de l'étape 3 a tourné 409 tours et émis 338 `win`
    // avant d'atteindre le garde-fou.
    if (won) {
      return { duelId, status: 'ended', messages, steps };
    }

    if (status === mod.OcgProcessResult.END) {
      return { duelId, status: 'ended', messages, steps };
    }
    if (status === mod.OcgProcessResult.CONTINUE) continue;

    return { duelId, status: 'awaiting_response', messages, steps };
  }

  return { duelId, status: 'stalled', messages, steps };
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

function createSession(req: Extract<EngineRequest, { type: 'create' }>): EngineTurnResult {
  const lib = core!;
  const mod = ocg!;
  const cards = store!;

  if (sessions.has(req.duelId)) {
    destroySession(req.duelId);
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

  // Un générateur par joueur, dérivé de la même graine : les deux mélanges sont
  // indépendants mais l'ensemble reste reproductible.
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

  sessions.set(req.duelId, { handle, createdAt: Date.now() });

  lib.startDuel(handle);
  return pump(lib, mod, req.duelId);
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
    const { core: lib, ocg: mod } = await ensureReady();

    switch (req.type) {
      case 'create':
        return { id: req.id, ok: true, result: createSession(req) };
      case 'respond': {
        const session = sessions.get(req.duelId);
        if (!session) throw new Error(`duel ${req.duelId} inconnu du moteur`);
        lib.duelSetResponse(session.handle, req.response);
        return { id: req.id, ok: true, result: pump(lib, mod, req.duelId) };
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
