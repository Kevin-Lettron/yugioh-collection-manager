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
  /** Annoncer une valeur (type, attribut, carte, nombre). */
  | 'announce'
  /**
   * Le moteur demande quelque chose que la traduction ne couvre pas encore.
   * Le front l'affiche comme tel plutôt que de bloquer en silence.
   */
  | 'unsupported';

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
}

/** Réponse du joueur : les identifiants d'options retenus, dans l'ordre choisi. */
export interface DuelChoice {
  optionIds: string[];
  /** true pour « je passe » quand `canCancel` l'autorise. */
  cancel?: boolean;
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
}
