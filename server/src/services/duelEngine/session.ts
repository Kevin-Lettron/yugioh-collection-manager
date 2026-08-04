import type { OcgCoreSync, OcgDuelHandle, OcgMessage } from 'ocgcore-wasm';
import type {
  DuelChoice,
  DuelLogEntry,
  DuelSeat,
  DuelStateResponse,
} from '../../../../shared/duelView';
import type { CardStore } from './cardStore';
import { buildBoardView } from './snapshot';
import { buildPrompt, buildResponse } from './prompt';

/**
 * Un duel en cours : le handle du moteur, plus le peu d'état que le moteur ne
 * sait pas rendre.
 *
 * Le plateau, lui, n'est **pas** stocké — il est réinterrogé au moteur à chaque
 * vue (cf. `snapshot.ts`). Ce qui vit ici, c'est uniquement ce qui n'existe que
 * dans le fil des messages : le tour, la phase, les points de vie, l'issue de
 * la partie, et le journal.
 */

type Ocg = typeof import('ocgcore-wasm');

/** Au-delà, on ne garde que la fin : un journal sert à comprendre le coup précédent. */
const LOG_LIMIT = 400;

/**
 * Noms de phases, en anglais.
 *
 * C'est la langue du jeu de compétition : « Main Phase 1 » et « Battle Phase »
 * sont les termes qu'emploient les joueurs, y compris francophones. Les
 * traduire ferait plus obstacle qu'aide.
 *
 * Les valeurs sont celles de `OcgPhase` ; on les code en dur plutôt que
 * d'importer le module ESM du moteur, que ce fichier n'a pas d'autre raison de
 * charger.
 */
const PHASE_NAMES: Record<number, string> = {
  0x1: 'Draw Phase',
  0x2: 'Standby Phase',
  0x4: 'Main Phase 1',
  0x8: 'Battle Phase',
  0x10: 'Battle Step',
  0x20: 'Damage Step',
  0x40: 'Damage Calculation',
  0x80: 'Battle Phase',
  0x100: 'Main Phase 2',
  0x200: 'End Phase',
};

const WIN_REASONS: Record<number, string> = {
  0: 'points de vie à zéro',
  1: 'points de vie à zéro',
  2: 'deck épuisé',
  3: 'abandon',
  4: 'victoire par effet',
};

export class DuelSession {
  readonly handle: OcgDuelHandle;
  readonly createdAt = Date.now();
  /** Dernière interaction. Sert à repérer les duels abandonnés (cf. worker.ts). */
  lastActivityAt = Date.now();

  touch(): void {
    this.lastActivityAt = Date.now();
  }

  turn = 1;
  phase = 0;
  turnPlayer: DuelSeat = 0;
  lp: [number, number];

  /** Dernière demande du moteur restée sans réponse. Sert de dictionnaire au retour. */
  pending: OcgMessage | null = null;
  ended = false;
  winner: DuelSeat | null = null;
  winReason: string | null = null;

  private readonly log: DuelLogEntry[] = [];

  constructor(handle: OcgDuelHandle, startingLP: number) {
    this.handle = handle;
    this.lp = [startingLP, startingLP];
  }

  /**
   * Déroule le moteur jusqu'à ce qu'il réclame une décision ou termine.
   *
   * `duelGetMessage` doit être appelé **à chaque tour de boucle** : le moteur
   * vide sa file interne, ce qui n'est pas relevé est perdu.
   */
  pump(lib: OcgCoreSync, ocg: Ocg, store: CardStore, maxSteps: number): void {
    this.pending = null;

    for (let step = 0; step < maxSteps; step++) {
      const status = lib.duelProcess(this.handle);

      let won = false;
      const batch: OcgMessage[] = [];
      for (const message of lib.duelGetMessage(this.handle)) {
        if (!message) continue;
        batch.push(message);
        this.absorb(ocg, store, message);
        if (message.type === ocg.OcgMessageType.WIN) won = true;
      }

      // C'est **l'hôte** qui arrête la partie, pas le moteur : mesuré, le moteur
      // émet `win` puis redemande une décision comme si de rien n'était.
      if (won || status === ocg.OcgProcessResult.END) {
        this.ended = true;
        return;
      }
      if (status === ocg.OcgProcessResult.CONTINUE) continue;

      // Le moteur attend : la demande est le dernier message émis.
      this.pending = batch[batch.length - 1] ?? null;
      return;
    }

    // Garde-fou : une boucle infinie dans un worker est indétectable de dehors.
    this.pending = null;
  }

  /** Met à jour l'état hors-plateau et alimente le journal. */
  private absorb(ocg: Ocg, store: CardStore, message: OcgMessage): void {
    const M = ocg.OcgMessageType;
    const name = (code: number) => store.names.get(code) || `Carte ${code}`;

    switch (message.type) {
      case M.NEW_TURN:
        this.turn += 1;
        this.turnPlayer = message.player === 1 ? 1 : 0;
        this.push({ kind: 'new_turn', text: `Turn ${this.turn}` });
        return;

      case M.NEW_PHASE:
        this.phase = message.phase;
        // Journalisé, et pas seulement mémorisé : entre deux consultations, le
        // moteur peut traverser plusieurs phases d'un coup. Le front ne verrait
        // alors que la dernière, et ne pourrait pas annoncer la séquence
        // « nouveau tour, pioche, phase principale » que vit réellement le
        // joueur.
        this.push({ kind: 'new_phase', text: PHASE_NAMES[message.phase] ?? 'Phase' });
        return;

      case M.DAMAGE: {
        const seat = message.player === 1 ? 1 : 0;
        this.lp[seat] = Math.max(0, this.lp[seat] - message.amount);
        this.push({ kind: 'damage', text: `${message.amount} dégâts (joueur ${seat + 1})` });
        return;
      }

      case M.RECOVER: {
        const seat = message.player === 1 ? 1 : 0;
        this.lp[seat] += message.amount;
        this.push({ kind: 'recover', text: `+${message.amount} PV (joueur ${seat + 1})` });
        return;
      }

      case M.PAY_LPCOST: {
        const seat = message.player === 1 ? 1 : 0;
        this.lp[seat] = Math.max(0, this.lp[seat] - message.amount);
        this.push({ kind: 'pay_lpcost', text: `${message.amount} PV payés (joueur ${seat + 1})` });
        return;
      }

      case M.LPUPDATE: {
        // Message autoritaire : il remplace notre suivi, il ne s'y ajoute pas.
        const seat = message.player === 1 ? 1 : 0;
        this.lp[seat] = message.lp;
        return;
      }

      case M.WIN:
        this.winner = message.player === 1 ? 1 : 0;
        this.winReason = WIN_REASONS[message.reason] ?? `raison ${message.reason}`;
        this.push({
          kind: 'win',
          text: `Victoire du joueur ${this.winner + 1} — ${this.winReason}`,
        });
        return;

      case M.DRAW:
        this.push({
          kind: 'draw',
          text: `Le joueur ${(message.player === 1 ? 1 : 0) + 1} pioche ${message.drawn.length} carte${
            message.drawn.length > 1 ? 's' : ''
          }`,
        });
        return;

      case M.SUMMONING:
        this.push({
          kind: 'summoning',
          text: `Invocation de ${name(message.code)}`,
          codes: [message.code],
        });
        return;

      case M.SPSUMMONING:
        this.push({
          kind: 'spsummoning',
          text: `Invocation Spéciale de ${name(message.code)}`,
          codes: [message.code],
        });
        return;

      case M.FLIPSUMMONING:
        this.push({
          kind: 'flipsummoning',
          text: `Invocation Flip de ${name(message.code)}`,
          codes: [message.code],
        });
        return;

      case M.CHAINING:
        this.push({ kind: 'chaining', text: `${name(message.code)} s'active`, codes: [message.code] });
        return;

      case M.ATTACK:
        // `OcgLocPos` ne porte que l'emplacement, pas le passcode : le journal
        // reste générique, le plateau montre déjà quel monstre attaque.
        this.push({ kind: 'attack', text: "Déclaration d'attaque" });
        return;

      case M.SET:
        this.push({ kind: 'set', text: 'Une carte est posée face cachée' });
        return;

      default:
        return;
    }
  }

  private push(entry: DuelLogEntry): void {
    this.log.push(entry);
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
  }

  /**
   * Traduit la décision d'un joueur et la transmet au moteur.
   *
   * Refuse si ce n'est pas à ce joueur de répondre : sans ce contrôle, un
   * client pourrait jouer à la place de son adversaire.
   */
  applyChoice(lib: OcgCoreSync, ocg: Ocg, seat: DuelSeat, choice: DuelChoice, store: CardStore): void {
    if (!this.pending) {
      throw new Error("Le moteur n'attend aucune décision");
    }
    const prompt = buildPrompt(ocg, this.pending, store);
    if (!prompt) throw new Error('Demande illisible');
    if (prompt.seat !== seat) {
      throw new Error("Ce n'est pas à toi de répondre");
    }

    const response = buildResponse(ocg, this.pending, choice);
    lib.duelSetResponse(this.handle, response);
  }

  /** Vue destinée à un siège, information cachée déjà filtrée. */
  view(lib: OcgCoreSync, ocg: Ocg, duelId: number, seat: DuelSeat, store: CardStore): DuelStateResponse {
    const board = buildBoardView(
      lib,
      ocg,
      this.handle,
      seat,
      { turn: this.turn, phase: this.phase, turnPlayer: this.turnPlayer, lp: this.lp },
      store
    );

    const prompt = this.pending ? buildPrompt(ocg, this.pending, store) : null;

    return {
      duelId,
      status: this.ended ? 'ended' : this.pending ? 'awaiting_response' : 'stalled',
      board,
      // Une demande adressée à l'adversaire ne doit pas fuiter : elle révélerait
      // ce qu'il a en main ou ce qu'il peut activer.
      prompt: prompt && prompt.seat === seat ? prompt : null,
      log: this.log.slice(-60),
      winner: this.winner,
      winReason: this.winReason ?? undefined,
    };
  }
}
