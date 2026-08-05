import type { OcgCoreSync, OcgDuelHandle, OcgMessage } from 'ocgcore-wasm';
import type {
  DuelAnimationEvent,
  DuelChoice,
  DuelCombatLogEntry,
  DuelLogEntry,
  DuelReveal,
  DuelRevealBatch,
  DuelSeat,
  DuelStateResponse,
  DuelTossEvent,
} from '../../../../shared/duelView';
import type { CardStore } from './cardStore';
import { cardNameOf } from './cardStore';
import { buildBoardView } from './snapshot';
import { buildPrompt, buildResponse } from './prompt';
import { systemString } from './hintStrings';
import logger from '../../utils/logger';

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
 * Durée d'affichage d'une carte révélée par un `CONFIRM_*`.
 *
 * Trop court, on rate l'information ; trop long, elle superpose la révélation
 * suivante. Six secondes tiennent le temps de lire un nom et de reconnaître
 * l'illustration.
 */
const REVEAL_TTL_MS = 6000;

/**
 * Durée d'affichage d'un lancer de pièce ou de dés.
 *
 * Court : le résultat parle de lui-même, une fois lu il ne sert plus. Trop
 * long, il resterait à l'écran alors que la chaîne suivante est déjà lancée.
 */
const TOSS_TTL_MS = 4000;

/** Au-delà, la narration de combat se recycle en glissant sur les 20 derniers. */
const COMBAT_LOG_LIMIT = 20;

/**
 * Durée d'affichage d'une animation avant qu'elle ne quitte le snapshot.
 *
 * 2 s : le mouvement lui-même dure 300 à 500 ms côté CSS ; le reste est du
 * flou de sécurité pour absorber un poll qui arrive tard. Au-delà, une
 * animation qui reviendrait à chaque `view()` finirait par se rejouer en
 * boucle.
 */
const ANIMATION_TTL_MS = 2000;

/**
 * Nombre d'animations conservées en mémoire.
 *
 * Purement une rambarde contre un script qui déclencherait 500 mouvements
 * d'un coup. 60 tient largement le pic d'un combo méta (~30 événements) tout
 * en évitant de faire enfler le snapshot indéfiniment.
 */
const ANIMATION_LIMIT = 60;

/** Sous-type d'invocation Spéciale, lu depuis le masque de type d'une carte. */
const SPSUMMON_VARIANTS: Array<[number, string]> = [
  [67108864, 'link'],
  [8388608, 'xyz'],
  [8192, 'synchro'],
  [64, 'fusion'],
  [128, 'ritual'],
  [16777216, 'pendulum'],
];

function spsummonVariant(cardType: number): string | undefined {
  for (const [bit, name] of SPSUMMON_VARIANTS) {
    if ((cardType & bit) !== 0) return name;
  }
  return undefined;
}

/** Origine d'une carte révélée, décodée depuis un `OcgLocation`. */
function revealOrigin(location: number): DuelReveal['from'] {
  switch (location) {
    case 0x1:
      return 'deck';
    case 0x2:
      return 'hand';
    case 0x10:
      return 'grave';
    case 0x40:
      return 'extra';
    case 0x4:
    case 0x8:
    case 0x100:
    case 0x200:
      return 'field';
    default:
      return 'unknown';
  }
}

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
  readonly duelId: number;
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

  /**
   * Dernière réponse refusée par le moteur, par siège.
   *
   * `RETRY` ne porte pas de joueur : c'est notre suivi de « qui vient de
   * répondre » qui indique à qui remonter le refus. Effacé au coup accepté
   * suivant du même siège.
   */
  private lastRetry: [
    { at: number; note?: string } | null,
    { at: number; note?: string } | null,
  ] = [null, null];

  /** Sert à imputer le prochain `RETRY` au bon siège. */
  private lastRespondingSeat: DuelSeat | null = null;

  /**
   * Cartes révélées récemment aux joueurs (CONFIRM_CARDS / _DECKTOP / _EXTRATOP).
   *
   * Les entrées vieillissent puis disparaissent : le moteur, lui, garde son
   * état ; ici on ne conserve que le temps de l'animation.
   */
  private reveals: DuelRevealBatch[] = [];

  /**
   * Lancers de pièce et de dés récents (`MSG_TOSS_COIN`, `MSG_TOSS_DICE`).
   *
   * Publics dès qu'ils tombent — contrairement aux révélations, il n'y a pas
   * d'intimité à protéger. On les fait expirer sur le même modèle pour ne pas
   * les traîner sur toute la partie.
   */
  private tosses: DuelTossEvent[] = [];

  /**
   * Narration de combat en flux — MSG_ATTACK, MSG_BATTLE, MSG_DAMAGE_STEP_*,
   * MSG_MISSED_EFFECT, MSG_CHAIN_NEGATED/_DISABLED, MSG_WAITING.
   *
   * Le journal principal (`this.log`) mélange déjà les phases et les
   * invocations ; le combat mérite son propre flux, plus resserré, pour ne pas
   * noyer une attaque annulée dans dix messages de phase.
   */
  private combatLog: DuelCombatLogEntry[] = [];

  /**
   * Animations de plateau récentes (§3.2 du plan).
   *
   * Distinct du journal et de la narration de combat : ce sont les événements
   * visuels du plateau que le front rejoue en fondu ou en glissement — un
   * mouvement de carte, un marqueur qui pop, une invocation Spéciale avec son
   * portail typé, un halo de ciblage. Filtrées par siège dans `view()` :
   * `SHUFFLE_HAND` porte les passcodes de la main, il ne doit **jamais** partir
   * à l'adversaire.
   */
  private animations: DuelAnimationEvent[] = [];

  /**
   * Dernière invite pour laquelle un `MSG_HINT · SELECTMSG / MESSAGE` a été émis.
   *
   * Le moteur envoie le HINT **avant** la demande de sélection ; on le mémorise
   * pour l'attacher à l'invite courante quand elle sera construite.
   */
  private pendingHint: { title?: string; note?: string; seat: DuelSeat } | null = null;

  /**
   * Table courante des libellés d'effets pour `SELECT_OPTION`.
   *
   * Le moteur peut émettre plusieurs `HINT · OPSELECTED` d'affilée avant un
   * `SELECT_OPTION`, chacun portant le texte d'un effet. On les accumule puis
   * on les transmet à la traduction — `prompt.ts` en fait ses libellés d'effet
   * réels au lieu d'« Effet 1 ».
   */
  private pendingOptionLabels: string[] = [];

  /**
   * Rang du maillon en cours de résolution (posé à `CHAIN_SOLVING`, retiré à
   * `CHAIN_SOLVED` ou `CHAIN_END`). Le snapshot le remonte au front pour qu'il
   * puisse mettre le maillon actif en surbrillance dans le ChainPanel.
   */
  private chainSolvingLink: number | null = null;

  constructor(handle: OcgDuelHandle, startingLP: number, duelId: number = 0) {
    this.handle = handle;
    this.duelId = duelId;
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
        this.absorb(ocg, store, message, this.duelId);
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
  private absorb(ocg: Ocg, store: CardStore, message: OcgMessage, duelId?: number): void {
    const M = ocg.OcgMessageType;
    // Nom localisé (FR si dispo, sinon EN, sinon `Carte NNN`). Alimente le
    // journal, les toasts et les descriptions d'animations.
    const name = (code: number) => cardNameOf(store, code);

    switch (message.type) {
      case M.RETRY: {
        // Le moteur n'indique pas de qui vient le refus : on impute au dernier
        // siège qui a répondu, celui qu'on a mémorisé dans `applyChoice`.
        // Sans lui, tout bogue de traduction ressemble à un gel à l'écran.
        const seat = this.lastRespondingSeat ?? 0;
        this.lastRetry[seat] = {
          at: Date.now(),
          note: 'Coup refusé par le moteur — reprends ton choix.',
        };
        logger.warn(`[duel:retry] duelId=${duelId ?? '?'} player=${seat}`);
        return;
      }

      case M.CONFIRM_CARDS:
      case M.CONFIRM_DECKTOP:
      case M.CONFIRM_EXTRATOP: {
        // `player` est **celui à qui** les cartes sont révélées — c'est-à-dire
        // l'adversaire de celui qui les montre. La convention du moteur est
        // constante entre les trois messages.
        const forPlayer: DuelSeat = message.player === 1 ? 1 : 0;
        const cards: DuelReveal[] = message.cards.map((c) => {
          const from =
            message.type === M.CONFIRM_DECKTOP
              ? 'decktop'
              : message.type === M.CONFIRM_EXTRATOP
                ? 'extratop'
                : revealOrigin(c.location);
          const reveal: DuelReveal = { code: c.code, from };
          const nm = cardNameOf(store, c.code);
          if (nm) reveal.name = nm;
          return reveal;
        });
        if (cards.length) {
          this.reveals.push({
            forPlayer,
            cards,
            at: Date.now(),
            ttl: REVEAL_TTL_MS,
          });
        }
        return;
      }

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

      case M.DRAW: {
        const seat: DuelSeat = message.player === 1 ? 1 : 0;
        this.push({
          kind: 'draw',
          text: `Le joueur ${seat + 1} pioche ${message.drawn.length} carte${
            message.drawn.length > 1 ? 's' : ''
          }`,
        });
        // Animation de pioche §F3 — le siège qui pioche voit ses cartes
        // (codes), l'adversaire voit une pioche « aveugle » (juste le nombre).
        // On sépare en deux événements pour ne pas fuiter les codes de main.
        const codes = message.drawn.map((d) => d.code);
        this.pushAnim({
          kind: 'draw',
          description: `Pioche de ${message.drawn.length} carte${message.drawn.length > 1 ? 's' : ''}`,
          codes,
          controller: seat,
          count: message.drawn.length,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: seat,
        });
        const foe: DuelSeat = seat === 0 ? 1 : 0;
        this.pushAnim({
          kind: 'draw',
          description: `L'adversaire pioche ${message.drawn.length} carte${message.drawn.length > 1 ? 's' : ''}`,
          controller: seat,
          count: message.drawn.length,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: foe,
        });
        return;
      }

      case M.SUMMONING:
        this.push({
          kind: 'summoning',
          text: `Invocation de ${name(message.code)}`,
          codes: [message.code],
        });
        return;

      case M.SPSUMMONING: {
        this.push({
          kind: 'spsummoning',
          text: `Invocation Spéciale de ${name(message.code)}`,
          codes: [message.code],
        });
        // Détecte le sous-type (Fusion, Synchro, Xyz, Link, Ritual, Pendulum)
        // pour que le front joue l'animation appropriée — portail Xyz cyan,
        // cercle Synchro or, vortex Link violet. Le sous-type est déduit du
        // masque de type de la carte, connu dans `cardStore`.
        const cardData = store.data.get(message.code);
        const variant = cardData ? spsummonVariant(Number(cardData.type)) : undefined;
        this.pushAnim({
          kind: 'spsummoned',
          description: `Invocation Spéciale de ${name(message.code)}`,
          codes: [message.code],
          location: message.location,
          sequence: message.sequence,
          controller: message.controller,
          variant,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;
      }

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

      // ── §3.2 : narration/animations — messages qui alimentent le plateau.
      //   Filtrage par siège quand un passcode peut fuiter (SHUFFLE_HAND,
      //   DECK_TOP), sinon `both` par défaut.
      case M.SUMMONED:
        this.pushAnim({
          kind: 'summoned',
          description: 'Invocation Normale résolue',
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.SPSUMMONED:
        // L'animation a déjà été poussée par SPSUMMONING (avec le passcode et
        // la variante). Ce message n'ajoute rien de plus, on l'ignore
        // silencieusement plutôt que d'empiler un doublon.
        return;

      case M.FLIPSUMMONED:
        this.pushAnim({
          kind: 'flipsummoned',
          description: 'Flip Summon',
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.MOVE: {
        // MOVE porte from/to en OcgLocPos. Règle d'étanchéité : quand
        // l'origine OU la destination vaut HAND / DECK / EXTRA (zones
        // privées), on n'expose l'événement (avec code) qu'au propriétaire ;
        // l'adversaire voit le résultat au poll suivant, sans que le code
        // soit narré.
        const HIDDEN = 0x1 | 0x2 | 0x40; // DECK | HAND | EXTRA
        const fromHidden = (message.from.location & HIDDEN) !== 0;
        const toHidden = (message.to.location & HIDDEN) !== 0;
        const codes: number[] = message.card ? [message.card] : [];
        const seatOwner: DuelSeat = message.from.controller === 1 ? 1 : 0;
        this.pushAnim({
          kind: 'move',
          description: codes[0] ? `Déplacement de ${name(codes[0])}` : 'Déplacement de carte',
          codes: fromHidden || toHidden ? undefined : codes,
          location: message.to.location,
          sequence: message.to.sequence,
          controller: message.to.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: fromHidden || toHidden ? seatOwner : 'both',
        });
        return;
      }

      case M.POS_CHANGE:
        this.pushAnim({
          kind: 'pos_change',
          description: `Changement de position — ${name(message.code)}`,
          codes: [message.code],
          location: message.location,
          sequence: message.sequence,
          controller: message.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.SWAP:
        this.pushAnim({
          kind: 'swap',
          description: `${name(message.card1.code)} ↔ ${name(message.card2.code)}`,
          codes: [message.card1.code, message.card2.code],
          location: message.card1.location,
          sequence: message.card1.sequence,
          controller: message.card1.controller,
          toLocation: message.card2.location,
          toSequence: message.card2.sequence,
          toController: message.card2.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.EQUIP:
        this.pushAnim({
          kind: 'equip',
          description: 'Équipement lié',
          location: message.card.location,
          sequence: message.card.sequence,
          controller: message.card.controller,
          toLocation: message.target.location,
          toSequence: message.target.sequence,
          toController: message.target.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.SHUFFLE_HAND: {
        // `cards` liste les passcodes de la main — SECRET du propriétaire.
        // On restreint l'animation à ce joueur ; l'adversaire voit le simple
        // fait qu'une main est mélangée (info publique) via un événement
        // dérivé sans codes.
        const seat: DuelSeat = message.player === 1 ? 1 : 0;
        this.pushAnim({
          kind: 'shuffle_hand',
          description: 'Mélange de la main',
          codes: [...message.cards],
          controller: seat,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: seat,
        });
        // Pendant pour l'adversaire : même événement, sans codes.
        const foe: DuelSeat = seat === 0 ? 1 : 0;
        this.pushAnim({
          kind: 'shuffle_hand',
          description: "Mélange de la main de l'adversaire",
          controller: seat,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: foe,
        });
        return;
      }

      case M.SHUFFLE_DECK:
        this.pushAnim({
          kind: 'shuffle_deck',
          description: 'Mélange du deck',
          controller: message.player === 1 ? 1 : 0,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.SHUFFLE_EXTRA:
        // L'Extra Deck est public en YGO — les codes peuvent voyager.
        this.pushAnim({
          kind: 'shuffle_extra',
          description: 'Mélange de l\'Extra Deck',
          codes: [...message.cards],
          controller: message.player === 1 ? 1 : 0,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.DECK_TOP: {
        // `code` = passcode déposé sur le dessus du deck : SECRET, seul le
        // propriétaire (celui qui a triché en regardant) le sait.
        const seat: DuelSeat = message.player === 1 ? 1 : 0;
        this.pushAnim({
          kind: 'deck_top',
          description: `Sur le dessus du deck : ${name(message.code)}`,
          codes: [message.code],
          controller: seat,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: seat,
        });
        return;
      }

      case M.ADD_COUNTER:
        this.pushAnim({
          kind: 'add_counter',
          description: `+${message.count} marqueur${message.count > 1 ? 's' : ''}`,
          location: message.location,
          sequence: message.sequence,
          controller: message.controller,
          count: message.count,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.REMOVE_COUNTER:
        this.pushAnim({
          kind: 'remove_counter',
          description: `−${message.count} marqueur${message.count > 1 ? 's' : ''}`,
          location: message.location,
          sequence: message.sequence,
          controller: message.controller,
          count: message.count,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.BECOME_TARGET: {
        // Une ou plusieurs cartes deviennent cibles — halo rouge pulsant.
        // `OcgLocPos` ne porte pas de code : on cible par position seule, le
        // front lit la case pour trouver la carte concernée.
        for (const c of message.cards) {
          this.pushAnim({
            kind: 'become_target',
            description: 'Cible désignée',
            location: c.location,
            sequence: c.sequence,
            controller: c.controller,
            at: Date.now(),
            ttl: ANIMATION_TTL_MS,
            forPlayers: 'both',
          });
        }
        return;
      }

      case M.CARD_TARGET:
        this.pushAnim({
          kind: 'card_target',
          description: 'Liaison attaquant → cible',
          location: message.card.location,
          sequence: message.card.sequence,
          controller: message.card.controller,
          toLocation: message.target.location,
          toSequence: message.target.sequence,
          toController: message.target.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.CHAINED:
        this.pushAnim({
          kind: 'chained',
          description: `Chaîne #${message.chain_size}`,
          count: message.chain_size,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.CHAIN_SOLVING:
        this.chainSolvingLink = message.chain_size;
        this.pushAnim({
          kind: 'chain_solving',
          description: `Résolution du maillon #${message.chain_size}`,
          count: message.chain_size,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.CHAIN_SOLVED:
        // Résolution terminée pour ce maillon : on ne surligne plus rien tant
        // que le maillon suivant n'a pas commencé.
        if (this.chainSolvingLink === message.chain_size) this.chainSolvingLink = null;
        this.pushAnim({
          kind: 'chain_solved',
          description: `Maillon #${message.chain_size} résolu`,
          count: message.chain_size,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.CHAIN_END:
        this.chainSolvingLink = null;
        this.pushAnim({
          kind: 'chain_end',
          description: 'Chaîne terminée',
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.FIELD_DISABLED:
        this.pushAnim({
          kind: 'field_disabled',
          description: 'Zones du terrain désactivées',
          count: message.field_mask,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.CARD_HINT:
        // `card_hint` sert à mettre une carte en évidence (par ex. « regarde
        // ceci »). On garde l'animation courte : c'est un signal, pas un
        // événement de jeu.
        this.pushAnim({
          kind: 'card_hint',
          description: 'Carte mise en évidence',
          location: message.location,
          sequence: message.sequence,
          controller: message.controller,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;

      case M.PLAYER_HINT: {
        // Bandeau côté joueur — le texte vient de `description`, un bigint qui
        // ID une entrée `!system`. On tente la résolution, à défaut un
        // libellé générique.
        const text = systemString(message.description) ?? 'Indice';
        this.pushAnim({
          kind: 'player_hint',
          description: text,
          controller: message.player === 1 ? 1 : 0,
          at: Date.now(),
          ttl: ANIMATION_TTL_MS,
          forPlayers: 'both',
        });
        return;
      }

      case M.ATTACK:
        // `OcgLocPos` ne porte que l'emplacement, pas le passcode : le journal
        // reste générique, le plateau montre déjà quel monstre attaque.
        this.push({ kind: 'attack', text: "Déclaration d'attaque" });
        this.pushCombat({
          kind: 'attack',
          description: "Déclaration d'attaque",
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.SET:
        this.push({ kind: 'set', text: 'Une carte est posée face cachée' });
        return;

      // ── Narration de combat (§3.1 du plan) — chacune fait sa ligne dans le flux.
      case M.BATTLE:
        this.pushCombat({
          kind: 'battle',
          description: 'Combat en cours',
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.ATTACK_DISABLED:
        this.pushCombat({
          kind: 'attack_disabled',
          description: 'Attaque annulée',
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.DAMAGE_STEP_START:
        this.pushCombat({
          kind: 'damage_step_start',
          description: 'Damage Step',
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.DAMAGE_STEP_END:
        this.pushCombat({
          kind: 'damage_step_end',
          description: 'Fin de la Damage Step',
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.MISSED_EFFECT:
        this.pushCombat({
          kind: 'missed_effect',
          description: `Effet raté (timing) : ${name(message.code)}`,
          at: Date.now(),
          forPlayers: 'both',
          codes: [message.code],
        });
        return;

      case M.CHAIN_NEGATED:
        this.pushCombat({
          kind: 'chain_negated',
          description: `Chaîne #${message.chain_size} niée`,
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.CHAIN_DISABLED:
        this.pushCombat({
          kind: 'chain_disabled',
          description: `Effet chaîné #${message.chain_size} désactivé`,
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      case M.WAITING:
        this.pushCombat({
          kind: 'waiting',
          description: "L'adversaire réfléchit…",
          at: Date.now(),
          forPlayers: 'both',
        });
        return;

      // ── Pièce et dés (§3.1 du plan) — le résultat est un événement bref.
      case M.TOSS_COIN: {
        const byPlayer: DuelSeat = message.player === 1 ? 1 : 0;
        // Le moteur émet des booléens ; on les projette en 0/1 pour la couche
        // partagée qui n'a pas de sérialiseur booléen.
        this.tosses.push({
          kind: 'coin',
          results: message.results.map((b) => (b ? 1 : 0)),
          byPlayer,
          at: Date.now(),
          ttl: TOSS_TTL_MS,
        });
        this.push({
          kind: 'toss_coin',
          text: `Pièce : ${message.results.map((b) => (b ? 'Face' : 'Pile')).join(', ')}`,
        });
        return;
      }

      case M.TOSS_DICE: {
        const byPlayer: DuelSeat = message.player === 1 ? 1 : 0;
        this.tosses.push({
          kind: 'dice',
          results: [...message.results],
          byPlayer,
          at: Date.now(),
          ttl: TOSS_TTL_MS,
        });
        this.push({
          kind: 'toss_dice',
          text: `Dés : ${message.results.join(', ')}`,
        });
        return;
      }

      // ── HINT : traduction des libellés d'effets et des invites (§5 du plan).
      case M.HINT: {
        const h = message;
        const T = ocg.OcgHintType;
        const seat: DuelSeat = h.player === 1 ? 1 : 0;
        // `hint` est un `bigint` : la valeur est un identifiant vers strings.conf.
        const text = systemString(h.hint);

        switch (h.hint_type) {
          case T.SELECTMSG:
          case T.MESSAGE:
            // Attaché à la prochaine invite. Si `text` est absent, on garde
            // au moins le seat pour l'imputation à un joueur.
            this.pendingHint = text
              ? { title: text, seat }
              : { seat };
            return;
          case T.EVENT:
            if (text) this.push({ kind: 'hint', text });
            return;
          case T.OPSELECTED:
            // Le moteur enverra un `SELECT_OPTION` juste après ; on empile les
            // libellés d'options dans l'ordre.
            if (text) this.pendingOptionLabels.push(text);
            return;
          case T.EFFECT: {
            // Décoré : le texte est le nom de l'effet. Attaché à l'invite en
            // cours comme note supplémentaire.
            if (text) {
              // Fusionne avec un hint titre déjà posé (SELECTMSG), sinon crée-en un.
              if (this.pendingHint) {
                this.pendingHint.note = text;
              } else {
                this.pendingHint = { note: text, seat };
              }
            }
            return;
          }
          case T.CARD: {
            // Le moteur pointe une carte concrète — passcode dans `hint`.
            // On l'ajoute au journal côté joueur destinataire.
            const code = Number(h.hint);
            if (Number.isInteger(code) && code > 0) {
              const nm = cardNameOf(store, code);
              this.push({ kind: 'hint_card', text: `Carte visée : ${nm}`, codes: [code] });
              this.pushAnim({
                kind: 'card_hint',
                description: `Carte visée : ${nm}`,
                codes: [code],
                controller: seat,
                at: Date.now(),
                ttl: ANIMATION_TTL_MS,
                forPlayers: 'both',
              });
            }
            return;
          }
          case T.ZONE: {
            // Le moteur pointe une zone du plateau. `hint` est un masque de
            // zones, on log juste que « zone visée : masque 0xNN ».
            const mask = Number(h.hint);
            if (Number.isFinite(mask)) {
              this.push({
                kind: 'hint_zone',
                text: `Zone visée (masque 0x${mask.toString(16)})`,
              });
            }
            return;
          }
          case T.NUMBER: {
            const n = Number(h.hint);
            if (Number.isFinite(n)) {
              this.push({ kind: 'hint_number', text: `Valeur annoncée : ${n}` });
            }
            return;
          }
          case T.RACE: {
            const mask = Number(h.hint);
            this.push({ kind: 'hint_race', text: `Type visé (masque 0x${mask.toString(16)})` });
            return;
          }
          case T.ATTRIB: {
            const mask = Number(h.hint);
            this.push({
              kind: 'hint_attrib',
              text: `Attribut visé (masque 0x${mask.toString(16)})`,
            });
            return;
          }
          case T.CODE: {
            const code = Number(h.hint);
            if (Number.isInteger(code) && code > 0) {
              const nm = cardNameOf(store, code);
              this.push({ kind: 'hint_code', text: `Carte annoncée : ${nm}`, codes: [code] });
            }
            return;
          }
          default:
            return;
        }
      }

      // ── Messages non absorbés jusqu'ici — cf. audit §5.2 recommandations 14
      case M.SHOW_HINT: {
        // Bandeau texte libre — quelques cartes rares (Number 39 Utopia,
        // Duel Terminal) l'utilisent pour un message explicite. Le champ
        // `hint` est déjà une chaîne selon le .d.ts.
        const text = message.hint || '(indice)';
        this.pushCombat({
          kind: 'waiting',
          description: `Indice : ${text}`,
          at: Date.now(),
          forPlayers: 'both',
        });
        return;
      }

      case M.SWAP_GRAVE_DECK: {
        const seat: DuelSeat = message.player === 1 ? 1 : 0;
        this.push({
          kind: 'swap_grave_deck',
          text: `Le joueur ${seat + 1} échange son deck avec son cimetière`,
        });
        return;
      }

      case M.SHUFFLE_SET_CARD: {
        // Mélange de cartes face verso sur le terrain (Necrovalley…). Le
        // moteur envoie les emplacements ; on log l'événement.
        this.push({
          kind: 'shuffle_set_card',
          text: 'Mélange des cartes posées face verso',
        });
        return;
      }

      case M.REVERSE_DECK: {
        this.push({ kind: 'reverse_deck', text: 'Le deck est retourné (dessus / dessous inversés)' });
        return;
      }

      case M.CARD_SELECTED: {
        // Annonce publique qu'une carte a été retenue par un effet.
        for (const c of message.cards) {
          this.pushAnim({
            kind: 'become_target',
            description: 'Sélection par effet',
            location: c.location,
            sequence: c.sequence,
            controller: c.controller,
            at: Date.now(),
            ttl: ANIMATION_TTL_MS,
            forPlayers: 'both',
          });
        }
        return;
      }

      case M.RANDOM_SELECTED: {
        const seat: DuelSeat = message.player === 1 ? 1 : 0;
        this.push({
          kind: 'random_selected',
          text: `Sélection aléatoire pour le joueur ${seat + 1}`,
        });
        for (const c of message.cards) {
          this.pushAnim({
            kind: 'become_target',
            description: 'Sélection aléatoire',
            location: c.location,
            sequence: c.sequence,
            controller: c.controller,
            at: Date.now(),
            ttl: ANIMATION_TTL_MS,
            forPlayers: 'both',
          });
        }
        return;
      }

      case M.CANCEL_TARGET: {
        // Un ciblage devient invalide (Fissure sur un monstre qui a quitté le
        // terrain, par exemple). Journalisé pour éviter que le halo reste
        // orphelin à l'écran. On pousse aussi une anim invisible pour purger
        // les halos actifs sur la cible.
        this.push({ kind: 'cancel_target', text: 'Ciblage annulé' });
        this.pushAnim({
          kind: 'card_hint',
          description: 'Ciblage annulé',
          location: message.target.location,
          sequence: message.target.sequence,
          controller: message.target.controller,
          at: Date.now(),
          ttl: 500,
          forPlayers: 'both',
        });
        return;
      }

      case M.REMOVE_CARDS: {
        // Suppression massive de cartes (Harpie's Feather Duster, Raigeki,
        // Dark Hole…). On log un compte global.
        const n = message.cards?.length ?? 0;
        this.pushCombat({
          kind: 'attack_disabled',
          description: `Retrait massif de ${n} carte${n > 1 ? 's' : ''}`,
          at: Date.now(),
          forPlayers: 'both',
        });
        return;
      }

      case M.BE_CHAIN_TARGET: {
        // Une carte devient cible d'un maillon de chaîne — spécifique.
        this.push({ kind: 'be_chain_target', text: 'Carte visée par un maillon' });
        return;
      }

      case M.CREATE_RELATION: {
        this.push({ kind: 'create_relation', text: 'Lien entre deux cartes établi' });
        return;
      }

      case M.RELEASE_RELATION: {
        this.push({ kind: 'release_relation', text: 'Lien entre deux cartes rompu' });
        return;
      }

      case M.START: {
        // Log discret de démarrage — pratique en rehydrate / spectateur.
        this.push({ kind: 'start', text: 'Partie démarrée' });
        return;
      }

      default:
        return;
    }
  }

  private pushCombat(entry: DuelCombatLogEntry): void {
    this.combatLog.push(entry);
    if (this.combatLog.length > COMBAT_LOG_LIMIT) {
      this.combatLog.splice(0, this.combatLog.length - COMBAT_LOG_LIMIT);
    }
  }

  private pushAnim(entry: DuelAnimationEvent): void {
    this.animations.push(entry);
    if (this.animations.length > ANIMATION_LIMIT) {
      this.animations.splice(0, this.animations.length - ANIMATION_LIMIT);
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
    const prompt = buildPrompt(ocg, this.pending, store, this.consumeHintFor(seat));
    if (!prompt) throw new Error('Demande illisible');
    if (prompt.seat !== seat) {
      throw new Error("Ce n'est pas à toi de répondre");
    }

    // Deux effets à mémoriser AVANT `duelSetResponse` :
    //   1. Qui répond, pour imputer un éventuel `RETRY` au bon siège ;
    //   2. Effacer l'ancien refus : si l'appel suivant a pu partir, c'est que
    //      le joueur a corrigé — sinon `absorb(RETRY)` le reposera.
    this.lastRespondingSeat = seat;
    this.lastRetry[seat] = null;

    const response = buildResponse(ocg, this.pending, prompt, choice, store);
    lib.duelSetResponse(this.handle, response);

    // Le hint courant a été consommé par la construction de `prompt` ; les
    // libellés d'effets aussi. On les réinitialise pour la prochaine invite.
    this.pendingOptionLabels = [];
    this.pendingHint = null;
  }

  /**
   * Consomme un hint pour l'invite courante, s'il est destiné à ce siège.
   *
   * Le moteur adresse toujours HINT et SELECT_* au même joueur ; on vérifie
   * quand même pour éviter d'attribuer un hint qui aurait « débordé » d'un
   * cycle précédent.
   */
  private consumeHintFor(seat: DuelSeat):
    | {
        hint?: { title?: string; note?: string };
        optionLabels?: string[];
      }
    | undefined {
    const hint = this.pendingHint && this.pendingHint.seat === seat
      ? { title: this.pendingHint.title, note: this.pendingHint.note }
      : undefined;
    const labels = this.pendingOptionLabels.length ? [...this.pendingOptionLabels] : undefined;
    if (!hint && !labels) return undefined;
    return { hint, optionLabels: labels };
  }

  /** Vue destinée à un siège, information cachée déjà filtrée. */
  view(lib: OcgCoreSync, ocg: Ocg, duelId: number, seat: DuelSeat, store: CardStore): DuelStateResponse {
    const board = buildBoardView(
      lib,
      ocg,
      this.handle,
      seat,
      {
        turn: this.turn,
        phase: this.phase,
        turnPlayer: this.turnPlayer,
        lp: this.lp,
        chainSolvingLink: this.chainSolvingLink,
      },
      store
    );

    const prompt = this.pending
      ? buildPrompt(ocg, this.pending, store, this.consumeHintFor(seat))
      : null;

    // Purge les révélations et lancers trop vieux au passage. C'est peu coûteux
    // et évite de faire enfler les listes indéfiniment sur les longues parties.
    const now = Date.now();
    this.reveals = this.reveals.filter((r) => now - r.at < r.ttl);
    this.tosses = this.tosses.filter((t) => now - t.at < t.ttl);
    this.animations = this.animations.filter((a) => now - a.at < a.ttl);
    const myReveals = this.reveals.filter((r) => r.forPlayer === seat);

    // Le combat log est public — filtré uniquement quand `forPlayers` restreint.
    const combatVisible = this.combatLog.filter(
      (e) => e.forPlayers === 'both' || e.forPlayers === seat
    );

    // Étanchéité : les animations `SHUFFLE_HAND` et `DECK_TOP` portent des
    // passcodes que l'adversaire n'a pas le droit de voir — le champ
    // `forPlayers` a été posé au moment du push, on ne filtre qu'ici.
    const animationsVisible = this.animations.filter(
      (a) => a.forPlayers === 'both' || a.forPlayers === seat
    );

    const response: DuelStateResponse = {
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

    // `lastRetry` uniquement pour le siège concerné : l'adversaire n'a rien à
    // savoir d'un coup refusé qui n'est pas le sien.
    if (this.lastRetry[seat]) response.lastRetry = this.lastRetry[seat]!;
    if (myReveals.length) response.reveals = myReveals;
    if (this.tosses.length) response.tosses = [...this.tosses];
    if (combatVisible.length) response.combatLog = combatVisible;
    if (animationsVisible.length) response.animations = animationsVisible;

    return response;
  }

  /** Retourne le passcode attendu par le moteur pour une réponse ANNOUNCE_CARD, avec vérification opcodes. */
  peekPendingMessage(): OcgMessage | null {
    return this.pending;
  }

  /**
   * Vue destinée à un spectateur — F7 du plan.
   *
   * Contrat : jamais aucune main détaillée, jamais de prompt, jamais de reveal
   * privé. Le combatLog et les animations « both » restent visibles ; les
   * animations `SHUFFLE_HAND` / `DECK_TOP` ne le sont pas (elles portent des
   * passcodes secrets d'un joueur). Aucune interaction possible : le spectateur
   * ne peut pas répondre, `choose` refusera pour un siège de -1.
   */
  spectate(lib: OcgCoreSync, ocg: Ocg, duelId: number, store: CardStore): DuelStateResponse {
    // On construit sur seat 0 arbitrairement — la géométrie ne change pas, et
    // le mode spectator masque ce qui doit l'être.
    const board = buildBoardView(
      lib,
      ocg,
      this.handle,
      0,
      {
        turn: this.turn,
        phase: this.phase,
        turnPlayer: this.turnPlayer,
        lp: this.lp,
        chainSolvingLink: this.chainSolvingLink,
      },
      store,
      true
    );

    const now = Date.now();
    this.reveals = this.reveals.filter((r) => now - r.at < r.ttl);
    this.tosses = this.tosses.filter((t) => now - t.at < t.ttl);
    this.animations = this.animations.filter((a) => now - a.at < a.ttl);

    // Combat log public uniquement.
    const combatVisible = this.combatLog.filter((e) => e.forPlayers === 'both');
    // Animations publiques uniquement — SHUFFLE_HAND / DECK_TOP / DRAW privés
    // ne fuitent pas.
    const animationsVisible = this.animations.filter((a) => a.forPlayers === 'both');

    const response: DuelStateResponse = {
      duelId,
      status: this.ended ? 'ended' : this.pending ? 'awaiting_response' : 'stalled',
      board,
      prompt: null,
      log: this.log.slice(-60),
      winner: this.winner,
      winReason: this.winReason ?? undefined,
    };
    if (this.tosses.length) response.tosses = [...this.tosses];
    if (combatVisible.length) response.combatLog = combatVisible;
    if (animationsVisible.length) response.animations = animationsVisible;
    return response;
  }
}
