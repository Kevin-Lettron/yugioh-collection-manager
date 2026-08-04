import type { OcgCoreSync, OcgDuelHandle, OcgLocation, OcgQueryFlags } from 'ocgcore-wasm';
import type {
  DuelBoardView,
  DuelCardView,
  DuelPhaseName,
  DuelSeat,
  DuelSideView,
  DuelZoneView,
} from '../../../../shared/duelView';
import type { CardStore } from './cardStore';

/**
 * Photographie du plateau, prise **auprès du moteur** et non déduite des
 * messages.
 *
 * Une interface de duel peut se construire de deux façons : rejouer les
 * messages pour maintenir son propre état, ou demander l'état au moteur après
 * chaque action. La première est celle qui désynchronise — il suffit d'un
 * message mal interprété, ou d'un joueur qui recharge la page, pour que
 * l'affichage mente. Le moteur, lui, sait toujours où en est la partie.
 *
 * Le filtrage de l'information cachée se fait ici. Le moteur répond à tout ce
 * qu'on lui demande, y compris la main adverse : c'est à l'hôte de ne pas
 * transmettre ce que le joueur n'a pas le droit de savoir.
 */

type Ocg = typeof import('ocgcore-wasm');

const FACEDOWN_MASK = 0xa; // FACEDOWN_ATTACK | FACEDOWN_DEFENSE

/**
 * Ce qu'on demande au moteur pour une carte.
 *
 * **`TYPE` est volontairement absent.** Demandé sur la main, il fait lever
 * `Error: eof` au lecteur binaire du paquet — testé drapeau par drapeau : c'est
 * le seul qui échoue, et seulement sur `HAND` ; sur les zones du terrain il
 * passe. L'erreur remonte comme une mort du worker, sans rien indiquer de la
 * cause.
 *
 * Ce n'est pas une perte : le type de la carte est déjà dans `cards.cdb`, qu'on
 * a intégralement en mémoire. On le lit là plutôt que de le redemander au
 * moteur.
 */
function queryFlags(ocg: Ocg): OcgQueryFlags {
  const F = ocg.OcgQueryFlags;
  return (
    F.CODE |
    F.POSITION |
    F.LEVEL |
    F.ATTACK |
    F.DEFENSE |
    F.OVERLAY_CARD |
    F.COUNTERS |
    F.IS_PUBLIC |
    F.IS_HIDDEN
  ) as OcgQueryFlags;
}

function phaseName(ocg: Ocg, phase: number): DuelPhaseName {
  const P = ocg.OcgPhase;
  switch (phase) {
    case P.DRAW:
      return 'draw';
    case P.STANDBY:
      return 'standby';
    case P.MAIN1:
      return 'main1';
    case P.BATTLE_START:
      return 'battle_start';
    case P.BATTLE_STEP:
      return 'battle_step';
    case P.DAMAGE:
      return 'damage';
    case P.DAMAGE_CAL:
      return 'damage_cal';
    case P.BATTLE:
      return 'battle';
    case P.MAIN2:
      return 'main2';
    case P.END:
      return 'end';
    default:
      return 'unknown';
  }
}

interface QueriedCard {
  code?: number;
  position?: number;
  attack?: number;
  defense?: number;
  level?: number;
  overlayCards?: number[];
  counters?: Record<number, number>;
  isPublic?: boolean;
  isHidden?: boolean;
}

/**
 * Projette une carte interrogée en vue, en masquant ce qui doit l'être.
 *
 * `visible` dit si **ce** spectateur a le droit de voir la face de la carte.
 * Une carte posée face cachée reste affichée — sa présence n'est pas un secret,
 * seule son identité l'est.
 */
function toView(card: QueriedCard, visible: boolean, store: CardStore): DuelCardView {
  const position = card.position ?? 0;
  const faceDown = (position & FACEDOWN_MASK) !== 0;
  const reveal = visible || !faceDown;
  const code = reveal ? (card.code ?? 0) : 0;

  const view: DuelCardView = {
    code,
    faceDown,
    position,
  };

  if (code) {
    const name = store.names.get(code);
    if (name) view.name = name;
    const description = store.descriptions.get(code);
    if (description) view.description = description;
    if (card.attack !== undefined) view.attack = card.attack;
    if (card.defense !== undefined) view.defense = card.defense;
    if (card.level !== undefined) view.level = card.level;
  }
  if (card.overlayCards?.length) view.materials = card.overlayCards.length;
  if (card.counters && Object.keys(card.counters).length) view.counters = card.counters;

  return view;
}

function queryZone(
  lib: OcgCoreSync,
  ocg: Ocg,
  handle: OcgDuelHandle,
  controller: DuelSeat,
  location: OcgLocation,
  visible: boolean,
  store: CardStore
): DuelZoneView[] {
  const rows = lib.duelQueryLocation(handle, {
    flags: queryFlags(ocg),
    controller,
    location,
  });

  return rows.map((row) => {
    if (!row) return null;
    // Une case vide revient parfois comme un objet sans code plutôt que null.
    if (!row.code && row.position === undefined) return null;
    return toView(row as QueriedCard, visible, store);
  });
}

function queryList(
  lib: OcgCoreSync,
  ocg: Ocg,
  handle: OcgDuelHandle,
  controller: DuelSeat,
  location: OcgLocation,
  visible: boolean,
  store: CardStore
): DuelCardView[] {
  return queryZone(lib, ocg, handle, controller, location, visible, store).filter(
    (c): c is DuelCardView => c !== null
  );
}

function buildSide(
  lib: OcgCoreSync,
  ocg: Ocg,
  handle: OcgDuelHandle,
  seat: DuelSeat,
  /** true quand la vue est destinée au propriétaire de ce côté. */
  own: boolean,
  sizes: {
    deck_size: number;
    hand_size: number;
    grave_size: number;
    banish_size: number;
    extra_size: number;
  },
  lp: number,
  store: CardStore
): DuelSideView {
  const L = ocg.OcgLocation;

  return {
    lp,
    monsters: queryZone(lib, ocg, handle, seat, L.MZONE, own, store),
    spells: queryZone(lib, ocg, handle, seat, L.SZONE, own, store),
    // La main adverse n'est jamais détaillée : seul son volume est public.
    hand: own ? queryList(lib, ocg, handle, seat, L.HAND, true, store) : [],
    handCount: sizes.hand_size,
    deckCount: sizes.deck_size,
    extraCount: sizes.extra_size,
    // Le cimetière est public des deux côtés — c'est une règle du jeu, pas un oubli.
    graveyard: queryList(lib, ocg, handle, seat, L.GRAVE, true, store),
    // Les bannies face cachée existent : `toView` masquera leur identité.
    banished: queryList(lib, ocg, handle, seat, L.REMOVED, own, store),
  };
}

export interface SnapshotContext {
  turn: number;
  phase: number;
  turnPlayer: DuelSeat;
  lp: [number, number];
}

/**
 * Construit la vue du plateau pour un siège donné.
 *
 * Le tour, la phase et les points de vie ne sont pas interrogeables : le moteur
 * ne les expose que par messages. L'appelant les tient à jour et les passe ici.
 */
export function buildBoardView(
  lib: OcgCoreSync,
  ocg: Ocg,
  handle: OcgDuelHandle,
  seat: DuelSeat,
  ctx: SnapshotContext,
  store: CardStore
): DuelBoardView {
  const field = lib.duelQueryField(handle);
  const foe: DuelSeat = seat === 0 ? 1 : 0;

  return {
    turn: ctx.turn,
    phase: phaseName(ocg, ctx.phase),
    turnPlayer: ctx.turnPlayer,
    seat,
    me: buildSide(lib, ocg, handle, seat, true, field.players[seat], ctx.lp[seat], store),
    opponent: buildSide(lib, ocg, handle, foe, false, field.players[foe], ctx.lp[foe], store),
    chainLength: field.chain.length,
  };
}
