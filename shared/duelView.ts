/**
 * Vocabulaire du duel moteur, partagé entre le serveur et les fronts.
 *
 * Le moteur parle une centaine de types de messages binaires et une vingtaine
 * de types de réponses. Exposer ça tel quel aux interfaces serait deux fois une
 * erreur : elles porteraient la logique du moteur, et un client malveillant
 * pourrait fabriquer n'importe quelle réponse.
 *
 * D'où ce contrat en trois pièces :
 *   - `DuelBoardView` — l'état du plateau **tel que ce joueur a le droit de le
 *     voir**. Il est interrogé au moteur, pas reconstruit à partir des messages :
 *     rejouer les deltas pour deviner l'état est la façon la plus sûre de
 *     désynchroniser une interface.
 *   - `DuelPrompt` — ce que le moteur demande, normalisé en options nommées.
 *   - `DuelChoice` — la réponse du joueur, par identifiant d'option. Le serveur
 *     retraduit ; le front ne connaît jamais les structures du moteur.
 */

export type DuelSeat = 0 | 1;

export type DuelPhaseName =
  | 'draw'
  | 'standby'
  | 'main1'
  | 'battle_start'
  | 'battle_step'
  | 'damage'
  | 'damage_cal'
  | 'battle'
  | 'main2'
  | 'end'
  | 'unknown';

/** Une carte telle qu'affichée. `code` vaut 0 quand ce joueur n'a pas le droit de la voir. */
export interface DuelCardView {
  /** Passcode, ou 0 si l'information est cachée pour ce joueur. */
  code: number;
  /** Nom, résolu côté serveur. Absent si la carte est cachée. */
  name?: string;
  /** Texte de la carte, tel que le moteur l applique. Pour le survol. */
  description?: string;
  /** Masque de position du moteur (1 attaque face visible, 8 défense face cachée, …). */
  position?: number;
  faceDown: boolean;
  attack?: number;
  defense?: number;
  level?: number;
  /** Nombre de matériaux Xyz superposés. */
  materials?: number;
  /** Marqueurs posés sur la carte, par type de marqueur. */
  counters?: Record<number, number>;
}

/** Zone occupée ou vide. */
export type DuelZoneView = DuelCardView | null;

export interface DuelSideView {
  lp: number;
  /**
   * Zones monstre : 5 principales puis 2 zones monstre supplémentaires.
   * Le moteur en expose toujours 7, même hors Master Rule 5.
   */
  monsters: DuelZoneView[];
  /** Zones magie/piège : 5 principales, le terrain, puis les 2 zones Pendule. */
  spells: DuelZoneView[];
  /** Main. Détaillée pour soi, réduite à son décompte pour l'adversaire. */
  hand: DuelCardView[];
  handCount: number;
  deckCount: number;
  extraCount: number;
  graveyard: DuelCardView[];
  banished: DuelCardView[];
}

export interface DuelBoardView {
  turn: number;
  phase: DuelPhaseName;
  /** Siège dont c'est le tour. */
  turnPlayer: DuelSeat;
  /** Le siège auquel cette vue est destinée. */
  seat: DuelSeat;
  me: DuelSideView;
  opponent: DuelSideView;
  /** Longueur de la chaîne en cours de résolution, 0 si aucune. */
  chainLength: number;
}

// ─── Demandes ───────────────────────────────────────────────────────────────

export type DuelPromptKind =
  /** Phase principale : invoquer, poser, activer, changer de phase. */
  | 'main'
  /** Phase de combat : attaquer, activer, changer de phase. */
  | 'battle'
  /** Choisir des cartes dans une liste. */
  | 'cards'
  /** Choisir une ou plusieurs zones du terrain. */
  | 'place'
  /** Choisir une position d'invocation. */
  | 'position'
  /** Oui / non. */
  | 'confirm'
  /** Choisir parmi des effets proposés. */
  | 'option'
  /** Répondre en chaîne, ou passer. */
  | 'chain'
  /** Ordonner des cartes. */
  | 'sort'
  /** Annoncer une valeur (type, attribut, nombre). */
  | 'announce'
  /**
   * Retirer des marqueurs (Spell Counters, glaçons Ice Barrier, etc.).
   * Le total sur `targets` doit valoir exactement `counter.count`.
   */
  | 'select_counter'
  /**
   * Nommer une carte (« déclarez le nom d'une carte »).
   * La liste est **trop grosse** (14 714 cartes) pour tenir dans une invite :
   * le front effectue une recherche typeahead via l'API dédiée, filtrée côté
   * serveur par les opcodes du moteur.
   */
  | 'announce_card'
  /**
   * Comme `cards` — la réponse porte des **passcodes** au lieu d'indices.
   * L'UI de sélection est identique, seule la sérialisation change.
   */
  | 'select_card_codes'
  /**
   * Le moteur demande quelque chose que la traduction ne couvre pas encore.
   * Le front l'affiche comme tel plutôt que de bloquer en silence.
   */
  | 'unsupported';

/** Une carte porteuse de marqueurs, pour l'invite `select_counter`. */
export interface DuelCounterTarget {
  /** Indice de la carte dans le message du moteur — sert de clé dans la réponse. */
  targetIdx: number;
  cardCode: number;
  cardName: string;
  location?: number;
  sequence?: number;
  controller?: DuelSeat;
  /** Nombre de marqueurs actuellement portés (donc plafond du curseur). */
  currentCount: number;
}

export interface DuelPromptOption {
  /** Identifiant opaque. C'est la seule chose que le front renvoie. */
  id: string;
  label: string;
  /** Passcode de la carte concernée, quand il y en a une — pour l'illustration. */
  code?: number;
  /** Emplacement, pour surligner la zone sur le plateau. */
  location?: number;
  sequence?: number;
  controller?: DuelSeat;
}

export interface DuelPrompt {
  kind: DuelPromptKind;
  /** Le siège à qui la question est posée. L'autre joueur attend. */
  seat: DuelSeat;
  /** Phrase d'invite, déjà en français quand le moteur en fournit une. */
  message: string;
  options: DuelPromptOption[];
  /** Nombre d'options à choisir. */
  min: number;
  max: number;
  /** Le joueur peut refuser de répondre (passer, annuler). */
  canCancel: boolean;
  /**
   * Payload spécifique à `select_counter` — les cartes concernées et le total
   * à retirer. `options` reste vide : cette invite ne se répond pas par
   * identifiants mais par un curseur par carte, via `DuelChoice.counters`.
   */
  counter?: {
    counterType: number;
    /** Nom lisible du type de marqueur si connu, sinon `Marqueur #NN`. */
    counterName: string;
    /** Total exact à retirer, réparti sur les cibles. */
    count: number;
    targets: DuelCounterTarget[];
  };
  /**
   * Payload spécifique à `announce_card` — la déclaration se fait par recherche
   * typeahead. Le front interroge `/duels/:id/engine/announce-card/search`
   * plutôt que d'afficher les 14 714 cartes.
   */
  announce?: {
    /** Hint humain (« Nomme un monstre LUMIÈRE de niveau 4 ou moins »). */
    hint?: string;
    /** Toujours vrai — présence de la clé = invite typeahead. */
    searchable: boolean;
  };
  /**
   * Hint venu du moteur (MSG_HINT · SELECTMSG / MESSAGE / OPSELECTED), traduit
   * via `strings.conf` d'EDOPro. Le titre s'affiche en tête du modal, la note
   * en sous-titre. Sans lui, le joueur voyait « Effet 1 » sans jamais savoir
   * lequel — c'est le point le plus voyant du plan §5.
   */
  hint?: {
    title?: string;
    note?: string;
  };
}

/** Réponse du joueur : les identifiants d'options retenus, dans l'ordre choisi. */
export interface DuelChoice {
  optionIds: string[];
  /** true pour « je passe » quand `canCancel` l'autorise. */
  cancel?: boolean;
  /**
   * SELECT_COUNTER — combien de marqueurs retirer par cible (`targetIdx` de
   * `DuelPrompt.counter.targets`). Le serveur vérifie que la somme vaut le
   * total demandé et refuse sinon, sans consulter le moteur.
   */
  counters?: Array<{ targetIdx: number; take: number }>;
  /**
   * ANNOUNCE_CARD — passcode de la carte déclarée, choisie via l'endpoint de
   * recherche. Le serveur revérifie que la carte passe le filtre d'opcodes
   * avant de la transmettre au moteur.
   */
  announcedCode?: number;
  /**
   * SELECT_CARD_CODES — passcodes retenus quand le moteur attend cette forme
   * de réponse plutôt que des indices. L'UI reste celle de `select_card`.
   */
  cardCodes?: number[];
}

/** Carte révélée à l'adversaire — CONFIRM_CARDS / DECKTOP / EXTRATOP. */
export interface DuelReveal {
  code: number;
  name?: string;
  /**
   * Origine de la carte, pour distinguer un « regarde ma main » d'un
   * « regarde le dessus de mon deck ».
   */
  from: 'hand' | 'deck' | 'grave' | 'field' | 'extra' | 'decktop' | 'extratop' | 'unknown';
}

/**
 * Résultat d'un lancer de pièce ou de dés (MSG_TOSS_COIN / MSG_TOSS_DICE).
 *
 * On garde le format identique à celui des révélations : un événement bref,
 * porté par la même mécanique de TTL — le moteur, lui, n'a pas d'état pour
 * ces messages, c'est à l'hôte d'en faire un morceau d'écran.
 */
export interface DuelTossEvent {
  kind: 'coin' | 'dice';
  /** Pile/face en booléens pour la pièce, 1 à 6 pour les dés. */
  results: number[];
  /** Le siège qui a effectué le lancer (les deux joueurs voient l'événement). */
  byPlayer: DuelSeat;
  at: number;
  ttl: number;
}

/**
 * Une salve de cartes révélées, transitoire.
 *
 * Elle vit `ttl` millisecondes puis s'efface — la révélation est un événement,
 * pas un état. Le front l'affiche en fade-in / fade-out, sans bloquer le jeu.
 */
export interface DuelRevealBatch {
  /** Le siège **à qui** les cartes sont montrées (l'adversaire de celui qui montre). */
  forPlayer: DuelSeat;
  cards: DuelReveal[];
  at: number;
  ttl: number;
}

// ─── Journal ────────────────────────────────────────────────────────────────

/**
 * Ligne de journal destinée à l'affichage. Volontairement pauvre : l'état fait
 * foi, le journal ne sert qu'à raconter ce qui vient de se passer.
 */
export interface DuelLogEntry {
  /** Type de message du moteur, en clair (`summoning`, `attack`, `chaining`…). */
  kind: string;
  text: string;
  /** Cartes citées, pour permettre au front d'afficher les vignettes. */
  codes?: number[];
}

/**
 * Ligne du journal de combat — un événement isolé qui raconte le combat.
 *
 * Distinct de `DuelLogEntry` (le déroulé général) : les cartes révélées, les
 * lancers de pièce, une attaque déclarée, un effet raté relèvent d'une
 * narration séparée que le joueur regarde de côté sans quitter le plateau
 * des yeux. `forPlayers` permet de restreindre certains événements (rarement
 * utile ici, mais utile un jour pour l'effet privé d'une carte).
 */
export interface DuelCombatLogEntry {
  kind:
    | 'attack'
    | 'battle'
    | 'attack_disabled'
    | 'damage_step_start'
    | 'damage_step_end'
    | 'missed_effect'
    | 'chain_negated'
    | 'chain_disabled'
    | 'waiting';
  description: string;
  at: number;
  /** Joueurs pour qui l'événement doit être affiché. `both` couvre le cas général. */
  forPlayers: DuelSeat | 'both';
  /** Passcodes cités — permet d'afficher une vignette dans le flux. */
  codes?: number[];
}

/**
 * Événement d'animation — Bloc 3, PARTIE B.
 *
 * Différent du `DuelLogEntry` (le récit) et du `DuelCombatLogEntry` (le flux de
 * combat) : ici on décrit un **mouvement à animer** sur le plateau (une carte
 * qui glisse, un marqueur qui apparaît, une invocation Spéciale par portail
 * Xyz, …). Le TTL court (2 s par défaut) évite de rejouer l'animation à chaque
 * poll : une fois périmée, elle disparaît du snapshot.
 *
 * `forPlayers` protège l'étanchéité : un `MSG_SHUFFLE_HAND` porte les
 * passcodes de la main, un `MSG_DECK_TOP` porte le passcode du dessus du
 * deck — ces événements ne doivent voyager que vers le joueur concerné.
 */
export interface DuelAnimationEvent {
  kind:
    | 'move'
    | 'pos_change'
    | 'swap'
    | 'equip'
    | 'shuffle_hand'
    | 'shuffle_deck'
    | 'shuffle_extra'
    | 'deck_top'
    | 'add_counter'
    | 'remove_counter'
    | 'become_target'
    | 'card_target'
    | 'summoned'
    | 'spsummoned'
    | 'flipsummoned'
    | 'chained'
    | 'chain_solving'
    | 'chain_solved'
    | 'chain_end'
    | 'field_disabled'
    | 'card_hint'
    | 'player_hint'
    | 'draw';
  /** Épitaphe : ce qui explique l'événement en clair au-dessus de l'animation. */
  description: string;
  /** Passcodes cités — vignette, halo… `codes` peut être vide (ex. shuffle_deck). */
  codes?: number[];
  /** Zone/case ciblée quand l'animation vise un emplacement précis. */
  location?: number;
  sequence?: number;
  controller?: DuelSeat;
  /**
   * Deuxième cible (SWAP, EQUIP, CARD_TARGET) — permet à l'UI de tracer un
   * lien entre les deux cases.
   */
  toLocation?: number;
  toSequence?: number;
  toController?: DuelSeat;
  /** Sous-type d'invocation Spéciale : Fusion, Synchro, Xyz, Link, Ritual, Pendulum. */
  variant?: string;
  /** Marqueurs : le nombre modifié. */
  count?: number;
  /**
   * Joueurs pour qui l'animation doit être diffusée. `both` couvre le cas
   * public par défaut. `SHUFFLE_HAND` et `DECK_TOP` doivent utiliser le
   * siège concerné pour ne pas fuiter les passcodes.
   */
  forPlayers: DuelSeat | 'both';
  at: number;
  ttl: number;
}

/**
 * Chronomètres de partie, en millisecondes.
 *
 * Chess-clock : chaque joueur a un budget total qui ne décompte que quand
 * c'est à lui de jouer ou de répondre. `runningFor` désigne le siège dont le
 * chrono tourne — `null` avant démarrage ou après victoire. `serverNow` sert
 * de référence pour compenser la dérive d'horloge entre client et serveur.
 */
export interface DuelClocks {
  p1Ms: number;
  p2Ms: number;
  runningFor: DuelSeat | null;
  serverNow: number;
}

/** Ce que le serveur renvoie après chaque action. */
export interface DuelStateResponse {
  duelId: number;
  status: 'awaiting_response' | 'ended' | 'stalled';
  board: DuelBoardView;
  /** Renseigné quand c'est à ce joueur de décider ; `null` sinon. */
  prompt: DuelPrompt | null;
  log: DuelLogEntry[];
  /** Siège vainqueur, quand la partie est finie. */
  winner?: DuelSeat | null;
  winReason?: string;
  /**
   * Le moteur a **refusé** la dernière réponse de ce joueur (message `RETRY`).
   * Sans cette remontée, le joueur croit à un gel : c'est le seul cas où l'on
   * doit signaler à quelqu'un que son propre coup n'a pas passé. Effacé dès
   * qu'une réponse suivante est acceptée. Uniquement présent pour le siège
   * en cause.
   */
  lastRetry?: { at: number; note?: string };
  /**
   * Cartes révélées à ce joueur pendant les 6 dernières secondes. Filtré côté
   * serveur : seules les révélations qui lui étaient destinées y figurent.
   */
  reveals?: DuelRevealBatch[];
  /**
   * Lancers de pièce / dés récents, communs aux deux joueurs (contrairement
   * aux révélations : un tirage est public dès qu'il tombe).
   */
  tosses?: DuelTossEvent[];
  /**
   * Vingt dernières lignes de la narration de combat (attaques, dégâts, effets
   * ratés, chaînes niées). Vidé au serveur au-delà de cette taille pour ne pas
   * fabriquer un flux infini.
   */
  combatLog?: DuelCombatLogEntry[];
  /**
   * Animations récentes du plateau (mouvements, marqueurs, invocations,
   * chaîne). Filtrées côté serveur par `forPlayers` — un `SHUFFLE_HAND`
   * n'arrive qu'au propriétaire de la main. TTL court (2 s par défaut).
   */
  animations?: DuelAnimationEvent[];
  /** Chronos courants — présent quand le duel est actif. */
  clocks?: DuelClocks;
}

/** Réponse de l'endpoint de recherche d'ANNOUNCE_CARD — top 20 cartes déclarables. */
export interface DuelAnnounceSearchResult {
  code: number;
  name: string;
}

// ─── Pile ou face au démarrage ──────────────────────────────────────────────

/**
 * État de la phase pré-game : pile ou face, puis choix de qui commence.
 *
 * Le duel entre en `awaiting_flip` juste après l'acceptation. Les deux joueurs
 * appellent `POST /duels/:id/coin-flip` ; à la deuxième réponse le serveur tire
 * un gagnant (RNG) et passe en `awaiting_choice`. Le gagnant seul peut appeler
 * `POST /duels/:id/first-player-choice` avec 'P1' ou 'P2'. Une fois `resolved`,
 * le moteur peut être lancé avec `first_player_id` posé.
 */
export type DuelPreGamePhase = 'awaiting_flip' | 'awaiting_choice' | 'resolved';

export interface DuelPreGameState {
  phase: DuelPreGamePhase;
  /** Joueurs ayant cliqué le bouton "lancer la pièce". Sert d'écran d'attente. */
  playersReady: number[];
  /** ID du gagnant du pile ou face — posé dès qu'on entre en `awaiting_choice`. */
  winnerId: number | null;
  /** Choix du gagnant, posé dès qu'on entre en `resolved`. */
  choice: 'P1' | 'P2' | null;
  /** ID du joueur qui commencera — posé en même temps que `choice`. */
  firstPlayerId: number | null;
  /**
   * Timestamp d'entrée en `awaiting_choice`. Sert au front à afficher un
   * décompte de 30 s ; passé ce délai, un appel `first-player-choice`
   * automatique avec 'P1' débloque la partie.
   */
  choiceDeadlineAt: number | null;
}
