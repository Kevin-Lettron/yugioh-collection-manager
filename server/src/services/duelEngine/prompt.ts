import type { OcgMessage, OcgResponse, SelectFieldPlace } from 'ocgcore-wasm';
import type {
  DuelChoice,
  DuelCounterTarget,
  DuelPrompt,
  DuelPromptOption,
  DuelSeat,
} from '../../../../shared/duelView';
import type { CardStore } from './cardStore';
import { counterString, systemString } from './hintStrings';

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

/**
 * Attache le hint courant à un prompt, en évitant l'écrasement des invites où
 * un titre local a plus de valeur que le texte système générique.
 */
function withHint(prompt: DuelPrompt, ctx?: PromptContext): DuelPrompt {
  if (!ctx?.hint) return prompt;
  const { title, note } = ctx.hint;
  if (!title && !note) return prompt;
  return { ...prompt, hint: { title, note } };
}

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

/**
 * Types de monstre et attributs, par bit.
 *
 * Le moteur les annonce sous forme de **masque** : chaque bit levé est une
 * valeur autorisée. Certaines cartes en interdisent une partie, d'où le
 * décodage plutôt qu'une liste figée.
 */
const RACE_NAMES: Array<[bigint, string]> = [
  [1n, 'Guerrier'],
  [2n, 'Magicien'],
  [4n, 'Elfe'],
  [8n, 'Bête'],
  [16n, 'Bête-Guerrier'],
  [32n, 'Dragon'],
  [64n, 'Zombie'],
  [128n, 'Aqua'],
  [256n, 'Pyro'],
  [512n, 'Rocher'],
  [1024n, 'Bête Ailée'],
  [2048n, 'Plante'],
  [4096n, 'Insecte'],
  [8192n, 'Tonnerre'],
  [16384n, 'Serpent de Mer'],
  [32768n, 'Serpent'],
  [65536n, 'Machine'],
  [131072n, 'Poisson'],
  [262144n, 'Dinosaure'],
  [524288n, 'Psychique'],
  [1048576n, 'Bête Divine'],
  [2097152n, 'Créature Divine'],
  [4194304n, 'Cyberse'],
  [8388608n, 'Illusion'],
];

const ATTRIBUTE_NAMES: Array<[bigint, string]> = [
  [1n, 'TERRE'],
  [2n, 'EAU'],
  [4n, 'FEU'],
  [8n, 'VENT'],
  [16n, 'LUMIÈRE'],
  [32n, 'TÉNÈBRES'],
  [64n, 'DIVIN'],
];

/** Décode un masque en options, en ne gardant que les bits autorisés. */
function maskOptions(
  table: Array<[bigint, string]>,
  mask: bigint,
  prefix: string
): DuelPromptOption[] {
  return table
    .filter(([bit]) => (mask & bit) !== 0n)
    .map(([bit, label]) => ({ id: `${prefix}:${bit}`, label }));
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
 * Contexte optionnel pour enrichir une invite.
 *
 * `hint` vient d'un `MSG_HINT · SELECTMSG / MESSAGE` reçu juste avant la
 * demande — le texte est celui d'EDOPro (`strings.conf`). `optionLabels` est
 * la suite ordonnée des libellés d'effets accumulés depuis les
 * `HINT · OPSELECTED` : utile pour transformer « Effet 1 » en le vrai texte
 * de l'effet.
 */
export interface PromptContext {
  hint?: { title?: string; note?: string };
  optionLabels?: string[];
}

/**
 * Traduit une demande du moteur en invite exploitable.
 *
 * Renvoie `null` si le message n'est pas une demande — l'appelant ne doit
 * appeler cette fonction que sur le dernier message d'un cycle bloqué.
 */
export function buildPrompt(
  ocg: Ocg,
  message: OcgMessage,
  store: CardStore,
  ctx?: PromptContext
): DuelPrompt | null {
  // On construit d'abord l'invite « nue » puis on lui attache le hint courant
  // en sortie. `SELECT_COUNTER` et `SELECT_OPTION` gèrent leur titre
  // eux-mêmes — pour les autres, `withHint` suffit à mettre le SELECTMSG
  // en avant.
  const result = translatePrompt(ocg, message, store, ctx);
  return result ? withHint(result, ctx) : result;
}

function translatePrompt(
  ocg: Ocg,
  message: OcgMessage,
  store: CardStore,
  ctx?: PromptContext
): DuelPrompt | null {
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
      // Deux sources possibles pour les libellés d'effets :
      //   1. Les `HINT · OPSELECTED` que le moteur a émis juste avant nous
      //      accumule le vrai texte des effets (via strings.conf).
      //   2. Le tableau `m.options` porte des `bigint` : chacun est aussi un ID
      //      vers strings.conf, qu'on résout via `systemString`.
      // On préfère la source 2, plus fiable (les OPSELECTED peuvent manquer
      // pour certains scripts), et on retombe sur 1 puis sur « Effet N ».
      const labels = ctx?.optionLabels ?? [];
      const options = m.options.map((code, i) => {
        const fromStrings = systemString(code);
        const label = fromStrings ?? labels[i] ?? `Effet ${i + 1}`;
        return { id: `option:${i}`, label };
      });
      return withHint(
        {
          kind: 'option',
          seat: seatOf(m.player),
          message: ctx?.hint?.title ?? 'Choisis un effet',
          options,
          min: 1,
          max: 1,
          canCancel: false,
        },
        ctx
      );
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

    case M.ANNOUNCE_RACE: {
      const m = message;
      // `available` est un masque : chaque bit encore levé est un type qu'on a
      // le droit d'annoncer. Certaines cartes en interdisent une partie.
      return {
        kind: 'announce',
        seat: seatOf(m.player),
        message:
          m.count > 1 ? `Annonce ${m.count} types de monstre` : 'Annonce un type de monstre',
        options: maskOptions(RACE_NAMES, BigInt(m.available), 'race'),
        min: m.count,
        max: m.count,
        canCancel: false,
      };
    }

    case M.ANNOUNCE_ATTRIB: {
      const m = message;
      return {
        kind: 'announce',
        seat: seatOf(m.player),
        message: m.count > 1 ? `Annonce ${m.count} attributs` : 'Annonce un attribut',
        options: maskOptions(ATTRIBUTE_NAMES, BigInt(m.available), 'attrib'),
        min: m.count,
        max: m.count,
        canCancel: false,
      };
    }

    case M.ANNOUNCE_NUMBER: {
      const m = message;
      return {
        kind: 'announce',
        seat: seatOf(m.player),
        message: 'Annonce un nombre',
        options: m.options.map((value, i) => ({
          id: `number:${i}`,
          label: String(value),
        })),
        min: 1,
        max: 1,
        canCancel: false,
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

    case M.SELECT_COUNTER: {
      const m = message;
      const targets: DuelCounterTarget[] = m.cards.map((c, i) => ({
        targetIdx: i,
        cardCode: c.code,
        cardName: nameOf(store, c.code),
        location: c.location,
        sequence: c.sequence,
        controller: seatOf(c.controller),
        currentCount: c.count,
      }));
      // Nom lisible du marqueur (« Spell Counter », « Ice Counter », …) via
      // `!counter` de strings.conf. Fallback : le numéro brut, qui a
      // au moins l'avantage de rester déterministe pour les tests.
      const counterName =
        counterString(m.counter_type) ?? `Marqueur #${m.counter_type}`;
      return withHint(
        {
          kind: 'select_counter',
          seat: seatOf(m.player),
          message:
            ctx?.hint?.title ?? `Retire ${m.count} marqueur${m.count > 1 ? 's' : ''}`,
          // Les options restent vides — l'UI utilise `counter` pour un curseur
          // par carte, et la réponse arrive dans `DuelChoice.counters`.
          options: [],
          min: 1,
          max: 1,
          canCancel: false,
          counter: {
            counterType: m.counter_type,
            counterName,
            count: m.count,
            targets,
          },
        },
        ctx
      );
    }

    case M.ANNOUNCE_CARD: {
      const m = message;
      // La liste des cartes légales pouvant être immense, on ne l'énumère pas
      // dans l'invite : le front fait une recherche typeahead et le serveur
      // rejoue les opcodes du moteur sur la carte proposée.
      return {
        kind: 'announce_card',
        seat: seatOf(m.player),
        message: 'Déclare le nom d\'une carte',
        options: [],
        min: 1,
        max: 1,
        canCancel: false,
        announce: {
          searchable: true,
        },
      };
    }

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
 *
 * `prompt` est fourni pour les invites dont la réponse ne se réduit pas à des
 * identifiants (SELECT_COUNTER : la somme des retraits doit valoir `count` ;
 * ANNOUNCE_CARD : la carte proposée doit vraiment passer les opcodes du
 * moteur). Le pass-through pour les autres invites reste inchangé.
 */
export function buildResponse(
  ocg: Ocg,
  message: OcgMessage,
  prompt: DuelPrompt,
  choice: DuelChoice,
  store?: CardStore
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
      // Cas SELECT_CARD_CODES : la traduction est identique côté prompt, mais
      // la réponse porte des passcodes plutôt que des indices. Le flag transite
      // via `DuelChoice.cardCodes` — le front l'a construit à partir de la même
      // liste d'options, il n'a pas à en connaître la sérialisation.
      if (choice.cardCodes !== undefined) {
        if (!Array.isArray(choice.cardCodes) || choice.cardCodes.some((c) => !Number.isInteger(c))) {
          return reject();
        }
        return { type: R.SELECT_CARD_CODES, codes: choice.cardCodes };
      }
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

    case M.ANNOUNCE_RACE: {
      // L'identifiant porte le bit lui-même, pas un rang : c'est ce que le
      // moteur attend, et ça évite de refaire le décodage à l'envers.
      const races = ids.map((id) => Number(indexOf(id, 'race')));
      if (races.some((r) => !Number.isFinite(r) || r <= 0)) return reject();
      return { type: R.ANNOUNCE_RACE, races: races as never[] };
    }

    case M.ANNOUNCE_ATTRIB: {
      const attributes = ids.map((id) => Number(indexOf(id, 'attrib')));
      if (attributes.some((a) => !Number.isFinite(a) || a <= 0)) return reject();
      return { type: R.ANNOUNCE_ATTRIB, attributes: attributes as never[] };
    }

    case M.ANNOUNCE_NUMBER: {
      const index = first ? indexOf(first, 'number') : null;
      if (index === null) return reject();
      // Le moteur attend l'indice dans la liste qu'il a proposée, pas la valeur.
      return { type: R.ANNOUNCE_NUMBER, value: index };
    }

    case M.SELECT_COUNTER: {
      const m = message;
      const takes = choice.counters;
      if (!Array.isArray(takes)) {
        throw new Error('SELECT_COUNTER attend un tableau `counters`');
      }
      // Un tableau de la taille exacte du message : le moteur lit un `u16` par
      // carte, y compris quand on retire zéro marqueur dessus.
      const buffer = new Array<number>(m.cards.length).fill(0);
      let total = 0;
      for (const { targetIdx, take } of takes) {
        if (!Number.isInteger(targetIdx) || targetIdx < 0 || targetIdx >= m.cards.length) {
          throw new Error(`Cible ${targetIdx} hors du message SELECT_COUNTER`);
        }
        if (!Number.isInteger(take) || take < 0) {
          throw new Error('Le nombre de marqueurs à retirer doit être un entier positif');
        }
        if (take > m.cards[targetIdx].count) {
          throw new Error(
            `Impossible de retirer ${take} marqueurs sur ${m.cards[targetIdx].count} disponibles`
          );
        }
        buffer[targetIdx] += take;
        total += take;
      }
      if (total !== m.count) {
        throw new Error(
          `Le total des marqueurs retirés (${total}) doit valoir ${m.count}`
        );
      }
      return { type: R.SELECT_COUNTER, counters: buffer };
    }

    case M.ANNOUNCE_CARD: {
      const code = choice.announcedCode;
      if (typeof code !== 'number' || !Number.isInteger(code) || code <= 0) {
        throw new Error('ANNOUNCE_CARD attend un passcode entier positif');
      }
      // On revérifie côté serveur — le front est déjà censé ne proposer que des
      // cartes qui passent, mais un client mal intentionné pourrait envoyer un
      // passcode arbitraire. `cardMatchesOpcode` est la fonction exportée par
      // `ocgcore-wasm` faite exactement pour ça.
      if (store) {
        const card = store.data.get(code);
        if (!card) {
          throw new Error(`Passcode ${code} inconnu de la base de cartes`);
        }
        if (!ocg.cardMatchesOpcode(card, message.opcodes)) {
          throw new Error(
            `La carte ${store.names.get(code) ?? code} ne passe pas le filtre du moteur`
          );
        }
      }
      return { type: R.ANNOUNCE_CARD, card: code };
    }

    default:
      throw new Error(
        `Le moteur attend une réponse que la traduction ne couvre pas encore ` +
          `(${ocg.ocgMessageTypeStrings.get(message.type) ?? message.type})`
      );
  }
}

/**
 * Recherche les cartes déclarables pour l'invite ANNOUNCE_CARD en cours.
 *
 * Renvoie les 20 premières cartes dont le nom contient la requête (case
 * insensitive) ET qui passent tous les opcodes du moteur. Sans le second
 * filtre, le joueur proposerait des cartes que le moteur refuserait par un
 * `retry` muet.
 */
export function searchAnnounceCards(
  ocg: Ocg,
  message: OcgMessage,
  store: CardStore,
  query: string,
  limit: number = 20
): Array<{ code: number; name: string }> {
  // On garde le contrôle explicite plutôt qu'un cast : si le message pending
  // n'est pas ANNOUNCE_CARD (parce que le joueur a envoyé sa recherche après
  // qu'une chaîne d'effets a changé l'invite), le worker doit refuser.
  if (!('opcodes' in message)) {
    throw new Error("Le moteur n'attend pas d'annonce de carte");
  }
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const opcodes = (message as { opcodes: Parameters<typeof ocg.cardMatchesOpcode>[1] }).opcodes;
  const results: Array<{ code: number; name: string }> = [];
  for (const [code, name] of store.names) {
    if (!name.toLowerCase().includes(needle)) continue;
    const card = store.data.get(code);
    if (!card) continue;
    if (!ocg.cardMatchesOpcode(card, opcodes)) continue;
    results.push({ code, name });
    if (results.length >= limit) break;
  }
  return results;
}
