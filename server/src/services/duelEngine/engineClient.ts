import path from 'path';
import { Worker } from 'worker_threads';
import type { OcgResponse } from 'ocgcore-wasm';
import logger from '../../utils/logger';
import { assetsInstalled, MISSING_ASSETS_HINT } from './paths';
import {
  isEngineNotice,
  type EngineNotice,
  type EnginePlayerDeck,
  type EngineRequest,
  type EngineRequestBody,
  type EngineResponse,
  type EngineStats,
  type EngineTurnResult,
} from './protocol';

/**
 * Façade du moteur de duel, côté fil principal.
 *
 * Un seul worker sert tous les duels : le moteur est réentrant par instance de
 * duel, et un worker par partie coûterait un tas WebAssembly complet à chaque
 * fois. Si la mesure de mémoire (`stats()`) montre que ça ne passe pas à
 * l'échelle, c'est ici qu'on introduira un pool — le reste du serveur ne verra
 * pas la différence.
 */

/** Au-delà, on considère le worker perdu. Une chaîne longue reste loin du compte. */
const REQUEST_TIMEOUT_MS = 30_000;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  label: string;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, Pending>();

/** Duels que le fil principal croit vivants dans le worker. */
const knownDuels = new Set<number>();

type WorkerLostHandler = (lostDuelIds: number[], reason: string) => void;
const lostHandlers: WorkerLostHandler[] = [];

/**
 * Prévenu quand le worker meurt : les duels en cours sont perdus avec lui.
 *
 * Le moteur n'expose aucune sérialisation d'une partie en cours — c'est une
 * limite de ygopro-core, pas un raccourci de notre part. La politique retenue
 * est d'annuler ces duels sans défaite pour personne (cf. docs/PLAN-MOTEUR-DUEL,
 * étape 4).
 */
export function onWorkerLost(handler: WorkerLostHandler): void {
  lostHandlers.push(handler);
}

function workerEntrypoint(): { spec: string; eval: boolean } {
  // En développement le serveur tourne sous ts-node et ce fichier est un `.ts` :
  // `new Worker()` ne sait pas charger du TypeScript. On amorce alors le worker
  // par un bout de code qui enregistre ts-node avant de charger le vrai module.
  if (__filename.endsWith('.ts')) {
    const tsPath = path.join(__dirname, 'worker.ts');
    return {
      spec: `require('ts-node/register'); require(${JSON.stringify(tsPath)});`,
      eval: true,
    };
  }
  return { spec: path.join(__dirname, 'worker.js'), eval: false };
}

function failAllPending(reason: string): void {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(`moteur indisponible (${reason}) pendant « ${p.label} »`));
  }
  pending.clear();
}

function handleWorkerDeath(reason: string): void {
  const lost = [...knownDuels];
  knownDuels.clear();
  worker = null;
  failAllPending(reason);

  if (lost.length) {
    logger.error(`[DUEL_ENGINE] worker perdu (${reason}) — ${lost.length} duel(s) annulé(s)`);
  } else {
    logger.warn(`[DUEL_ENGINE] worker perdu (${reason})`);
  }

  for (const handler of lostHandlers) {
    try {
      handler(lost, reason);
    } catch (err) {
      logger.error(`[DUEL_ENGINE] handler onWorkerLost en échec : ${err}`);
    }
  }
}

function ensureWorker(): Worker {
  if (worker) return worker;

  if (!assetsInstalled()) {
    throw new Error(MISSING_ASSETS_HINT);
  }

  const entry = workerEntrypoint();
  const w = new Worker(entry.spec, { eval: entry.eval });

  w.on('message', (msg: EngineResponse | EngineNotice) => {
    if (isEngineNotice(msg)) {
      if (msg.notice === 'ready') {
        logger.info('[DUEL_ENGINE] moteur prêt');
      } else {
        // Erreur remontée par un script Lua : le duel continue, mais c'est le
        // premier endroit où regarder quand une carte se comporte mal.
        logger.warn(`[DUEL_ENGINE] ${msg.detail ?? 'erreur moteur'}`);
      }
      return;
    }

    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);

    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  });

  w.on('error', (err) => handleWorkerDeath(err.message));
  w.on('exit', (code) => {
    if (worker === w) handleWorkerDeath(`sortie code ${code}`);
  });

  worker = w;
  return w;
}

function send<T>(req: EngineRequestBody, label: string): Promise<T> {
  const w = ensureWorker();
  const id = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // Un worker qui ne répond plus n'est pas récupérable : il tient le
      // moteur, on ne peut ni l'interrompre ni savoir où il en est.
      logger.error(`[DUEL_ENGINE] délai dépassé sur « ${label} » — worker terminé`);
      w.terminate().catch(() => undefined);
      reject(new Error(`le moteur n'a pas répondu (${label})`));
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, {
      resolve: resolve as (v: unknown) => void,
      reject,
      timer,
      label,
    });
    w.postMessage({ ...req, id } as EngineRequest);
  });
}

export interface CreateDuelParams {
  duelId: number;
  players: [EnginePlayerDeck, EnginePlayerDeck];
  /** Rejouer un duel à l'identique = réutiliser la graine. */
  seed?: [bigint, bigint, bigint, bigint];
  startingLP?: number;
  startingDrawCount?: number;
  drawCountPerTurn?: number;
}

/** Graine dérivée de l'identifiant du duel et de l'horloge : reproductible si fournie. */
function defaultSeed(duelId: number): [bigint, bigint, bigint, bigint] {
  const now = BigInt(Date.now());
  const base = BigInt(duelId);
  return [now, base, now ^ base, base * 6364136223846793005n];
}

export async function createEngineDuel(params: CreateDuelParams): Promise<EngineTurnResult> {
  const result = await send<EngineTurnResult>(
    {
      type: 'create',
      duelId: params.duelId,
      seed: params.seed ?? defaultSeed(params.duelId),
      players: params.players,
      startingLP: params.startingLP ?? 8000,
      startingDrawCount: params.startingDrawCount ?? 5,
      drawCountPerTurn: params.drawCountPerTurn ?? 1,
    },
    `create ${params.duelId}`
  );
  knownDuels.add(params.duelId);
  return result;
}

export function respondToEngine(duelId: number, response: OcgResponse): Promise<EngineTurnResult> {
  return send<EngineTurnResult>({ type: 'respond', duelId, response }, `respond ${duelId}`);
}

export async function destroyEngineDuel(duelId: number): Promise<void> {
  knownDuels.delete(duelId);
  if (!worker) return; // rien à détruire : le worker est déjà mort
  await send<null>({ type: 'destroy', duelId }, `destroy ${duelId}`);
}

export function engineStats(): Promise<EngineStats> {
  return send<EngineStats>({ type: 'stats' }, 'stats');
}

export function isDuelLive(duelId: number): boolean {
  return knownDuels.has(duelId);
}

/** Arrêt propre — appelé à l'extinction du serveur. */
export async function shutdownEngine(): Promise<void> {
  if (!worker) return;
  const w = worker;
  worker = null;
  knownDuels.clear();
  failAllPending('arrêt du serveur');
  await w.terminate();
}
