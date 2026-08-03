import type { OcgMessage, OcgResponse } from 'ocgcore-wasm';

/**
 * Protocole entre le fil principal et le worker qui héberge le moteur.
 *
 * Le moteur ne quitte jamais le worker : le fil principal ne manipule que des
 * identifiants de duel et des messages sérialisables. C'est ce qui permet de
 * redémarrer un worker mort sans toucher au reste du serveur.
 */

/** Les cartes d'un joueur, en passcodes, déjà résolues et validées. */
export interface EnginePlayerDeck {
  main: number[];
  extra: number[];
}

export type EngineRequest =
  | {
      id: number;
      type: 'create';
      duelId: number;
      /** Graine du générateur du moteur : même graine = même mélange. */
      seed: [bigint, bigint, bigint, bigint];
      players: [EnginePlayerDeck, EnginePlayerDeck];
      startingLP: number;
      startingDrawCount: number;
      drawCountPerTurn: number;
    }
  | { id: number; type: 'respond'; duelId: number; response: OcgResponse }
  | { id: number; type: 'destroy'; duelId: number }
  | { id: number; type: 'stats' };

/**
 * `Omit` appliqué à une union ne garde que les clés communes — ici, il ne
 * resterait que `type`. Cette variante distribue sur chaque branche.
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Une requête avant que le client ne lui affecte son identifiant. */
export type EngineRequestBody = DistributiveOmit<EngineRequest, 'id'>;

/** Ce que le moteur attend, une fois la boucle arrêtée. */
export type EngineStatus =
  | 'awaiting_response'
  | 'ended'
  /** Le moteur a rendu la main sans rien demander — anomalie, journalisée. */
  | 'stalled';

export interface EngineTurnResult {
  duelId: number;
  status: EngineStatus;
  /** Messages émis depuis la dernière réponse, dans l'ordre. */
  messages: OcgMessage[];
  /** Nombre d'itérations de `duelProcess` consommées — sert à repérer les boucles. */
  steps: number;
}

export interface EngineStats {
  activeDuels: number;
  /** `process.memoryUsage()` du worker : c'est lui qui porte le tas WebAssembly. */
  memory: {
    rss: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

export type EngineResponse =
  | { id: number; ok: true; result: EngineTurnResult | EngineStats | null }
  | { id: number; ok: false; error: string };

/** Émis spontanément par le worker, hors cycle requête/réponse. */
export interface EngineNotice {
  id: 0;
  notice: 'ready' | 'engine_error';
  detail?: string;
}

export function isEngineNotice(msg: EngineResponse | EngineNotice): msg is EngineNotice {
  return (msg as EngineNotice).id === 0 && 'notice' in msg;
}
