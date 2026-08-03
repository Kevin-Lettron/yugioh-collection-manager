import type { OcgMessage, OcgResponse, SelectFieldPlace } from 'ocgcore-wasm';
import type { DuelPrompt, DuelPromptOption, DuelSeat, DuelChoice } from '../../../../shared/duelView';
import type { CardStore } from './cardStore';

/**
 * Normalise les demandes du moteur, et retraduit les réponses du joueur.
 *
 * Le front ne voit jamais une structure du moteur : il reçoit des options avec
 * un identifiant opaque et renvoie les identifiants retenus. Deux raisons, dans
 * cet ordre d'importance :
 *
 *   1. **Sûreté.** Si le client fabriquait lui-même l'`OcgResponse`, il pourrait
 *      répondre à la place de l'adversaire, désigner une carte qu'on ne lui a
 *      pas proposée, ou envoyer une structure que le moteur refuserait par un
 *      `retry` muet. Ici, une option non proposée n'existe pas.
 *   2. Les interfaces n'ont pas à connaître le vocabulaire d'ocgcore.
 *
 * La demande brute reste côté serveur ; c'est elle qui sert de dictionnaire
 * pour reconstruire la réponse.
 */

type Ocg = typeof import('ocgcore-wasm');

const nameOf = (store: CardStore, code: number): string =>
  store.names.get(code) || `Carte ${code}`;

const seatOf = (player: number): DuelSeat => (player === 1 ? 1 : 0);

/** Libellé lisible d'un emplacement, pour les invites qui désignent une zone. */
function locationLabel(ocg: Ocg, location: number): string {
  const L = ocg.OcgLocation;
  switch (location) {
    case L.DECK:
      return 'Deck';
    case L.HAND:
      return 'Main';
    case L.MZONE:
      return 'Zone Monstre';
    case L.SZONE:
      return 'Zone Magie/Piège';
    case L.GRAVE:
      return 'Cimetière';
    case L.REMOVED:
      return 'Bannies';
    case L.EXTRA:
      return 'Extra Deck';
    case L.FZONE:
      return 'Terrain';
    case L.PZONE:
      return 'Zone Pendule';
    default:
      return 'Terrain';
  }
}

/** Les positions d'invocation possibles, décodées depuis leur masque. */
function positionOptions(ocg: Ocg, mask: number): DuelPromptOption[] {
  const P = ocg.OcgPosition;
  const all: Array<[number, string]> = [
    [P.FACEUP_ATTACK, 'Attaque face visible'],
    [P.FACEDOWN_ATTACK, 'Attaque face cachée'],
    [P.FACEUP_DEFENSE, 'Défense face visible'],
    [P.FACEDOWN_DEFENSE, 'Défense face cachée'],
  ];
  return all
    .filter(([bit]) => (mask & bit) !== 0)
    .map(([bit, label]) => ({ id: `pos:${bit}`, label }));
}

/**
 * Zones libres d'un masque de terrain.
 *
 * Deux conventions, et se tromper sur l'une ou l'autre fait rejeter la réponse
 * par un `retry` que le moteur n'explique pas :
 *   1. un bit **à 1 signifie indisponible** ;
 *   2. le masque est **relatif au joueur interrogé** — les octets sont, dans
 *      l'ordre : ses monstres, ses magies/pièges, ceux de l'adversaire.
 */
export function freePlaces(ocg: Ocg, mask: number, player: number): SelectFieldPlace[] {
  const self = seatOf(player);
  const foe: DuelSeat = self === 0 ? 1 : 0;

  const groups: Array<[shift: number, owner: DuelSeat, location: number]> = [
    [0, self, ocg.OcgLocation.MZONE],
    [8, self, ocg.OcgLocation.SZONE],
    [16, foe, ocg.OcgLocation.MZONE],
    [24, foe, ocg.OcgLocation.SZONE],
  ];

  const out: SelectFieldPlace[] = [];
  for (const [shift, owner, location] of groups) {
    for (let seq = 0; seq < 5; seq++) {
      if (((mask >>> (shift + seq)) & 1) === 0) {
        out.push({ player: owner, location: location as never, sequence: seq });
      }
    }
  }
  return out;
}

const cardOptions = (
  store: CardStore,
  prefix: string,
  cards: Array<{ code: number; controller?: number; location?: number; sequence?: number }>
): DuelPromptOption[] =>
  cards.map((c, i) => ({
    id: `${prefix}:${i}`,
    label: nameOf(store, c.code),
    code: c.code,
    location: c.location,
    sequence: c.sequence,
    controller: c.controller === undefined ? undefined : seatOf(c.controller),
  }));

/**
 * Traduit une demande du moteur en invite exploitable.
 *
 * Renvoie `null` si le message n'est pas une demande — l'appelant ne doit
 * appeler cette fonction que sur le dernier message d'un cycle bloqué.
 */
export function buildPrompt(ocg: Ocg, message: OcgMessage, store: CardStore): DuelPrompt | null {
  const M = ocg.OcgMessageType;

  switch (message.type) {
    case M.SELECT_IDLECMD: {
      const m = message;
      const options: DuelPromptOption[] = [
        ...cardOptions(store, 'summon', m.summons).map((o) => ({
          ...o,
          label: `Invoquer ${o.label}`,
        })),
        ...cardOptions(store, 'spsummon', m.special_summons).map((o) => ({
          ...o,
          label: `Invoquer Spécialement ${o.label}`,
        })),
        ...cardOptions(store, 'mset', m.monster_sets).map((o) => ({
          ...o,
          label: `Poser ${o.label}`,
        })),
        ...cardOptions(store, 'sset', m.spell_sets).map((o) => ({
          ...o,
          label: `Poser ${o.label}`,
        })),
        ...cardOptions(store, 'poschange', m.pos_changes).map((o) => ({
          ...o,
          label: `Changer la position de ${o.label}`,
        })),
        ...cardOptions(store, 'activate', m.activates).map((o) => ({
          ...o,
          label: `Activer ${o.label}`,
        })),
      ];
      if (m.to_bp) options.push({ id: 'tobp', label: 'Passer en Phase de Combat' });
      if (m.to_ep) options.push({ id: 'toep', label: 'Passer en Phase de Fin' });

      return {
        kind: 'main',
        seat: seatOf(m.player),
        message: 'Phase principale',
        options,
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_BATTLECMD: {
      const m = message;
      const options: DuelPromptOption[] = [
        ...cardOptions(store, 'attack', m.attacks).map((o) => ({
          ...o,
          label: `Attaquer avec ${o.label}`,
        })),
        ...cardOptions(store, 'activate', m.chains).map((o) => ({
          ...o,
          label: `Activer ${o.label}`,
        })),
      ];
      if (m.to_m2) options.push({ id: 'tom2', label: 'Passer en Phase Principale 2' });
      if (m.to_ep) options.push({ id: 'toep', label: 'Passer en Phase de Fin' });

      return {
        kind: 'battle',
        seat: seatOf(m.player),
        message: 'Phase de combat',
        options,
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_CARD: {
      const m = message;
      return {
        kind: 'cards',
        seat: seatOf(m.player),
        message:
          m.min === m.max
            ? `Choisis ${m.min} carte${m.min > 1 ? 's' : ''}`
            : `Choisis entre ${m.min} et ${m.max} cartes`,
        options: cardOptions(store, 'card', m.selects),
        min: m.min,
        max: m.max,
        canCancel: m.can_cancel,
      };
    }

    case M.SELECT_TRIBUTE: {
      const m = message;
      return {
        kind: 'cards',
        seat: seatOf(m.player),
        message: 'Choisis les monstres à sacrifier',
        options: cardOptions(store, 'tribute', m.selects),
        min: m.min,
        max: m.max,
        canCancel: m.can_cancel,
      };
    }

    case M.SELECT_UNSELECT_CARD: {
      const m = message;
      return {
        kind: 'cards',
        seat: seatOf(m.player),
        message: 'Choisis une carte',
        options: [
          ...cardOptions(store, 'select', m.select_cards),
          ...cardOptions(store, 'unselect', m.unselect_cards).map((o) => ({
            ...o,
            label: `Retirer ${o.label}`,
          })),
        ],
        min: 1,
        max: 1,
        canCancel: m.can_cancel,
      };
    }

    case M.SELECT_CHAIN: {
      const m = message;
      return {
        kind: 'chain',
        seat: seatOf(m.player),
        message: m.forced
          ? 'Tu dois activer un effet en chaîne'
          : 'Veux-tu répondre en chaîne ?',
        options: cardOptions(store, 'chain', m.selects).map((o) => ({
          ...o,
          label: `Activer ${o.label}`,
        })),
        min: m.forced ? 1 : 0,
        max: 1,
        canCancel: !m.forced,
      };
    }

    case M.SELECT_PLACE:
    case M.SELECT_DISFIELD: {
      const m = message;
      const places = freePlaces(ocg, m.field_mask, m.player);
      return {
        kind: 'place',
        seat: seatOf(m.player),
        message:
          message.type === M.SELECT_PLACE
            ? 'Choisis un emplacement'
            : 'Choisis un emplacement à neutraliser',
        options: places.map((p) => ({
          id: `place:${p.player}:${p.location}:${p.sequence}`,
          label: `${locationLabel(ocg, p.location)} ${p.sequence + 1}${
            p.player === seatOf(m.player) ? '' : ' (adverse)'
          }`,
          location: p.location,
          sequence: p.sequence,
          controller: seatOf(p.player),
        })),
        min: Math.max(1, m.count),
        max: Math.max(1, m.count),
        canCancel: false,
      };
    }

    case M.SELECT_POSITION: {
      const m = message;
      return {
        kind: 'position',
        seat: seatOf(m.player),
        message: `Position de ${nameOf(store, m.code)}`,
        options: positionOptions(ocg, m.positions),
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_OPTION: {
      const m = message;
      return {
        kind: 'option',
        seat: seatOf(m.player),
        message: 'Choisis un effet',
        // Les libellés d'effets sont des identifiants vers les textes d'EDOPro,
        // que nous n'embarquons pas. On numérote donc, faute de mieux.
        options: m.options.map((_, i) => ({ id: `option:${i}`, label: `Effet ${i + 1}` })),
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_EFFECTYN: {
      const m = message;
      return {
        kind: 'confirm',
        seat: seatOf(m.player),
        message: `Activer l'effet de ${nameOf(store, m.code)} ?`,
        options: [
          { id: 'yes', label: 'Oui' },
          { id: 'no', label: 'Non' },
        ],
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_YESNO: {
      const m = message;
      return {
        kind: 'confirm',
        seat: seatOf(m.player),
        message: 'Confirmer ?',
        options: [
          { id: 'yes', label: 'Oui' },
          { id: 'no', label: 'Non' },
        ],
        min: 1,
        max: 1,
        canCancel: false,
      };
    }

    case M.SELECT_SUM: {
      const m = message;
      return {
        kind: 'cards',
        seat: seatOf(m.player),
        message: `Choisis des cartes totalisant ${m.amount}`,
        options: [
          ...cardOptions(store, 'summust', m.selects_must),
          ...cardOptions(store, 'sum', m.selects),
        ],
        min: m.min,
        max: Math.max(m.min, m.selects.length + m.selects_must.length),
        canCancel: false,
      };
    }

    case M.SORT_CARD:
    case M.SORT_CHAIN: {
      const m = message;
      return {
        kind: 'sort',
        seat: seatOf(m.player),
        message: 'Ordonne les cartes',
        options: cardOptions(store, 'sort', m.cards),
        min: 0,
        max: m.cards.length,
        canCancel: true,
      };
    }

    case M.ROCK_PAPER_SCISSORS:
      return {
        kind: 'option',
        seat: seatOf(message.player),
        message: 'Pierre, feuille, ciseaux',
        options: [
          { id: 'rps:1', label: 'Ciseaux' },
          { id: 'rps:2', label: 'Pierre' },
          { id: 'rps:3', label: 'Feuille' },
        ],
        min: 1,
        max: 1,
        canCancel: false,
      };

    default: {
      // Le front doit pouvoir afficher « le moteur demande quelque chose que je
      // ne sais pas présenter » plutôt que de rester bloqué sans rien dire.
      const label = ocg.ocgMessageTypeStrings.get(message.type) ?? `type_${message.type}`;
      const player = 'player' in message ? (message.player as number) : 0;
      return {
        kind: 'unsupported',
        seat: seatOf(player),
        message: `Demande non prise en charge : ${label}`,
        options: [],
        min: 0,
        max: 0,
        canCancel: true,
      };
    }
  }
}

/**
 * Reconstruit la réponse attendue par le moteur à partir des identifiants
 * choisis.
 *
 * Lève si un identifiant ne correspond à rien dans la demande d'origine : c'est
 * exactement le cas qu'on veut attraper — un client qui invente une option.
 */
export function buildResponse(
  ocg: Ocg,
  message: OcgMessage,
  choice: DuelChoice
): OcgResponse {
  const R = ocg.OcgResponseType;
  const M = ocg.OcgMessageType;
  const ids = choice.optionIds ?? [];

  /** Extrait l'indice d'un identifiant `prefixe:indice`, en vérifiant le préfixe. */
  const indexOf = (id: string, ...prefixes: string[]): number | null => {
    const [prefix, rest] = id.split(':', 2);
    if (!prefixes.includes(prefix)) return null;
    const n = Number(rest);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const first = ids[0];
  const reject = (): never => {
    throw new Error(`Choix invalide pour cette demande : ${JSON.stringify(ids)}`);
  };

  switch (message.type) {
    case M.SELECT_IDLECMD: {
      const A = ocg.SelectIdleCMDAction;
      if (first === 'tobp') return { type: R.SELECT_IDLECMD, action: A.TO_BP, index: null };
      if (first === 'toep') return { type: R.SELECT_IDLECMD, action: A.TO_EP, index: null };

      const table: Array<[string, number]> = [
        ['summon', A.SELECT_SUMMON],
        ['spsummon', A.SELECT_SPECIAL_SUMMON],
        ['mset', A.SELECT_MONSTER_SET],
        ['sset', A.SELECT_SPELL_SET],
        ['poschange', A.SELECT_POS_CHANGE],
        ['activate', A.SELECT_ACTIVATE],
      ];
      for (const [prefix, action] of table) {
        const index = first ? indexOf(first, prefix) : null;
        if (index !== null) return { type: R.SELECT_IDLECMD, action, index };
      }
      return reject();
    }

    case M.SELECT_BATTLECMD: {
      const A = ocg.SelectBattleCMDAction;
      if (first === 'tom2') return { type: R.SELECT_BATTLECMD, action: A.TO_M2, index: null };
      if (first === 'toep') return { type: R.SELECT_BATTLECMD, action: A.TO_EP, index: null };

      const attack = first ? indexOf(first, 'attack') : null;
      if (attack !== null) {
        return { type: R.SELECT_BATTLECMD, action: A.SELECT_BATTLE, index: attack };
      }
      const activate = first ? indexOf(first, 'activate') : null;
      if (activate !== null) {
        return { type: R.SELECT_BATTLECMD, action: A.SELECT_CHAIN, index: activate };
      }
      return reject();
    }

    case M.SELECT_CARD: {
      if (choice.cancel) return { type: R.SELECT_CARD, indicies: null };
      const indices = ids.map((id) => indexOf(id, 'card'));
      if (indices.some((i) => i === null)) return reject();
      return { type: R.SELECT_CARD, indicies: indices as number[] };
    }

    case M.SELECT_TRIBUTE: {
      if (choice.cancel) return { type: R.SELECT_TRIBUTE, indicies: null };
      const indices = ids.map((id) => indexOf(id, 'tribute'));
      if (indices.some((i) => i === null)) return reject();
      return { type: R.SELECT_TRIBUTE, indicies: indices as number[] };
    }

    case M.SELECT_UNSELECT_CARD: {
      if (choice.cancel || !first) return { type: R.SELECT_UNSELECT_CARD, index: null };
      const select = indexOf(first, 'select');
      if (select !== null) return { type: R.SELECT_UNSELECT_CARD, index: select };
      const unselect = indexOf(first, 'unselect');
      if (unselect !== null) {
        // Convention du moteur : au-delà de la longueur des sélectionnables, on
        // désigne les désélectionnables.
        return {
          type: R.SELECT_UNSELECT_CARD,
          index: message.select_cards.length + unselect,
        };
      }
      return reject();
    }

    case M.SELECT_CHAIN: {
      if (choice.cancel || !first) return { type: R.SELECT_CHAIN, index: null };
      const index = indexOf(first, 'chain');
      if (index === null) return reject();
      return { type: R.SELECT_CHAIN, index };
    }

    case M.SELECT_PLACE:
    case M.SELECT_DISFIELD: {
      const places: SelectFieldPlace[] = [];
      for (const id of ids) {
        const parts = id.split(':');
        if (parts[0] !== 'place' || parts.length !== 4) return reject();
        const [, p, loc, seq] = parts;
        places.push({
          player: Number(p),
          location: Number(loc) as never,
          sequence: Number(seq),
        });
      }
      if (!places.length) return reject();
      return message.type === M.SELECT_PLACE
        ? { type: R.SELECT_PLACE, places }
        : { type: R.SELECT_DISFIELD, places };
    }

    case M.SELECT_POSITION: {
      const bit = first ? indexOf(first, 'pos') : null;
      if (bit === null) return reject();
      return { type: R.SELECT_POSITION, position: bit as never };
    }

    case M.SELECT_OPTION: {
      const index = first ? indexOf(first, 'option') : null;
      if (index === null) return reject();
      return { type: R.SELECT_OPTION, index };
    }

    case M.SELECT_EFFECTYN:
      return { type: R.SELECT_EFFECTYN, yes: first === 'yes' };

    case M.SELECT_YESNO:
      return { type: R.SELECT_YESNO, yes: first === 'yes' };

    case M.SELECT_SUM: {
      const indices = ids.map((id) => {
        const must = indexOf(id, 'summust');
        if (must !== null) return must;
        const sum = indexOf(id, 'sum');
        return sum === null ? null : sum;
      });
      if (indices.some((i) => i === null)) return reject();
      return { type: R.SELECT_SUM, indicies: indices as number[] };
    }

    case M.SORT_CARD:
    case M.SORT_CHAIN: {
      if (choice.cancel || !ids.length) return { type: R.SORT_CARD, order: null };
      const order = ids.map((id) => indexOf(id, 'sort'));
      if (order.some((i) => i === null)) return reject();
      return { type: R.SORT_CARD, order: order as number[] };
    }

    case M.ROCK_PAPER_SCISSORS: {
      const value = first ? indexOf(first, 'rps') : null;
      if (value !== 1 && value !== 2 && value !== 3) return reject();
      return { type: R.ROCK_PAPER_SCISSORS, value };
    }

    default:
      throw new Error(
        `Le moteur attend une réponse que la traduction ne couvre pas encore ` +
          `(${ocg.ocgMessageTypeStrings.get(message.type) ?? message.type})`
      );
  }
}
