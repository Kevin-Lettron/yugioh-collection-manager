import type { DuelChoice, DuelSeat, DuelStateResponse } from '../../../../shared/duelView';

/**
 * Protocole entre le fil principal et le worker qui héberge le moteur.
 *
 * Le moteur ne quitte jamais le worker : le fil principal ne manipule que des
 * identifiants de duel et des structures sérialisables. C'est ce qui permet de
 * redémarrer un worker mort sans toucher au reste du serveur.
 *
 * Rien de ce qui transite ici ne contient de structure d'ocgcore. La traduction
 * — messages vers vue, choix vers réponse — se fait **dans** le worker, au plus
 * près du moteur et de son état.
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
      /** Graine du générateur : même graine = même mélange. */
      seed: [bigint, bigint, bigint, bigint];
      players: [EnginePlayerDeck, EnginePlayerDeck];
      startingLP: number;
      startingDrawCount: number;
      drawCountPerTurn: number;
      /** Siège dont on veut la vue en retour. */
      seat: DuelSeat;
    }
  /** Décision d'un joueur, exprimée en identifiants d'options. */
  | { id: number; type: 'choose'; duelId: number; seat: DuelSeat; choice: DuelChoice }
  /** État courant, sans rien changer — pour un rechargement de page. */
  | { id: number; type: 'view'; duelId: number; seat: DuelSeat }
  | { id: number; type: 'destroy'; duelId: number }
  | { id: number; type: 'stats' };

/**
 * `Omit` appliqué à une union ne garde que les clés communes — ici, il ne
 * resterait que `type`. Cette variante distribue sur chaque branche.
 */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Une requête avant que le client ne lui affecte son identifiant. */
export type EngineRequestBody = DistributiveOmit<EngineRequest, 'id'>;

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
  | { id: number; ok: true; result: DuelStateResponse | EngineStats | null }
  | { id: number; ok: false; error: string };

/** Émis spontanément par le worker, hors cycle requête/réponse. */
export interface EngineNotice {
  id: 0;
  notice: 'ready' | 'engine_error' | 'duels_expired';
  detail?: string;
  /** Renseigné pour `duels_expired` : les duels libérés faute d'activité. */
  duelIds?: number[];
}

export function isEngineNotice(msg: EngineResponse | EngineNotice): msg is EngineNotice {
  return (msg as EngineNotice).id === 0 && 'notice' in msg;
}
