// Types miroirs de shared/types/index.ts (repo racine).
// Duplication assumée pour éviter la config Metro cross-package.
// Si tu modifies un type ici, pense à faire pareil dans shared/types/.

export type CardLanguage = 'EN' | 'FR' | 'DE' | 'IT' | 'PT' | 'SP' | 'JP' | 'KR';

export interface CardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped?: string;
}

export interface CardSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code?: string;
  set_price?: string;
}

export interface CardPrices {
  cardmarket_price?: string;
  tcgplayer_price?: string;
  ebay_price?: string;
  amazon_price?: string;
  coolstuffinc_price?: string;
}

export interface CollectionStats {
  total_cards: number;
  unique_cards: number;
  ultra_rares_count: number;
  secret_rares_count: number;
  total_value_eur: number;
  by_type: { monster: number; spell: number; trap: number; extra: number };
  recent_added_30d: number;
  rarities: string[];
  rarity_counts: Record<string, number>;
}

export interface DeckStats {
  main_count: number;
  extra_count: number;
  side_count: number;
  main_by_type: { monster: number; spell: number; trap: number };
  total_value_eur: number;
  copies_count: number;
}

export interface BanlistInfo {
  ban_tcg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_ocg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_goat?: 'Banned' | 'Limited' | 'Semi-Limited';
}

export interface Card {
  id: number;
  card_id: string;
  name: string;
  /** Nom officiel Konami TCG francais (API YGOProDeck ?language=fr). Fallback = name. */
  name_fr?: string | null;
  /** Nom anglais canonique. */
  name_en?: string | null;
  type: string;
  frame_type?: string;
  description?: string;
  /** Description officielle Konami TCG francais. Fallback = description. */
  description_fr?: string | null;
  /** Description anglaise canonique. */
  description_en?: string | null;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string;
  card_sets?: CardSet[];
  card_images?: CardImage[];
  card_prices?: CardPrices[];
  banlist_info?: BanlistInfo;
  linkval?: number;
  linkmarkers?: string[];
  scale?: number;
}

export interface UserCard {
  id: number;
  user_id: number;
  card_id: number;
  set_code: string;
  rarity: string;
  language: CardLanguage;
  quantity: number;
  created_at: string;
  updated_at: string;
  card?: Card;
}

export interface CollectionFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  attribute?: string;
  rarity?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

/**
 * 'card' = photo de la carte entière (identification par recoupement).
 * 'code' = gros plan sur le seul code de set, bien plus lisible.
 */
export type ScanMode = 'card' | 'code';

/** Ce que l'IA a lu sur la photo, avant confrontation avec la base YGOProDeck. */
export interface VisionReading {
  code: string | null;
  codeCandidates: string[];
  nameAsPrinted: string | null;
  nameEnglish: string | null;
  language: string | null;
  cardKind: 'Monster' | 'Spell' | 'Trap' | null;
  spellTrapType: string | null;
  monsterSubtypes: string[];
  attribute: string | null;
  level: number | null;
  linkRating: number | null;
  atk: number | null;
  def: number | null;
  edition: string | null;
  rarityHint: string | null;
  effectSnippet: string | null;
  confidence: number;
  notes?: string;
}

/** Résultat du recoupement entre la lecture et la carte trouvée en base. */
export interface ScanVerification {
  status: 'confirmed' | 'uncertain' | 'conflict';
  score: number;
  matched: string[];
  mismatched: string[];
  source: 'code' | 'name';
}

export interface ScanCandidate {
  code?: string;
  name: string;
  card: Card;
  officialImage?: string;
  availableRarities?: string[];
  detectedLanguage?: CardLanguage;
  score: number;
  source: 'code' | 'name';
}

export interface ScanResult {
  success: boolean;
  code?: string;
  name?: string;
  confidence?: number;
  card?: Card;
  availableRarities?: string[];
  officialImage?: string;
  detectedLanguage?: CardLanguage;
  notes?: string;
  error?: string;
  remainingScans?: number;
  verification?: ScanVerification;
  reading?: VisionReading;
  alternatives?: ScanCandidate[];
}

export const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  EN: 'Anglais',
  FR: 'Français',
  DE: 'Allemand',
  IT: 'Italien',
  PT: 'Portugais',
  SP: 'Espagnol',
  JP: 'Japonais',
  KR: 'Coréen',
};

// ─── Deck types ────────────────────────────────────────

export interface DeckUser {
  id: number;
  username: string;
  profile_picture?: string;
}

export interface DeckCard {
  id: number;
  deck_id: number;
  card_id: number;
  quantity: number;
  is_extra_deck: boolean;
  card?: Card;
}

export interface Deck {
  id: number;
  user_id: number;
  name: string;
  cover_image?: string;
  is_public: boolean;
  respect_banlist: boolean;
  is_shared?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
  user?: DeckUser;
  main_deck?: DeckCard[];
  extra_deck?: DeckCard[];
  likes_count?: number;
  dislikes_count?: number;
  comments_count?: number;
  user_reaction?: 'like' | 'dislike' | null;
  is_wishlisted?: boolean;
}

export interface DeckComment {
  id: number;
  user_id: number;
  deck_id: number;
  parent_comment_id?: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  user?: DeckUser;
  replies?: DeckComment[];
  replies_count?: number;
}

export interface DeckValidation {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface AIStatus {
  remaining: number;
  max: number;
  used: number;
}

// ─── Duel types ────────────────────────────────────────
// Duplication mobile de shared/types/index.ts — sync a la main.

export type DuelStatus = 'pending' | 'pre_game' | 'active' | 'finished' | 'cancelled';
export type DuelPreGamePhase = 'awaiting_flip' | 'awaiting_choice' | 'resolved';
export type DuelPhase = 'draw' | 'main1' | 'battle' | 'main2' | 'end';
export type DuelZone =
  | 'monster'
  | 'spelltrap'
  | 'field'
  | 'hand'
  | 'deck'
  | 'graveyard'
  | 'banished';

export interface BoardCard {
  card: DeckCard;
  faceDown: boolean;
  defenseMode?: boolean;
}

export interface PlayerBoardState {
  hand: DeckCard[];
  deck: DeckCard[];
  monsters: (BoardCard | null)[];
  spellTraps: (BoardCard | null)[];
  field: BoardCard | null;
  graveyard: DeckCard[];
  banished: DeckCard[];
}

export interface DuelChatMessage {
  user_id: number;
  username?: string;
  message: string;
  at: string;
}

export interface Duel {
  id: number;
  challenger_id: number;
  opponent_id: number;
  challenger?: DeckUser;
  opponent?: DeckUser;
  challenger_deck_id?: number | null;
  opponent_deck_id?: number | null;
  status: DuelStatus;
  winner_id?: number | null;
  first_player_id?: number | null;
  current_turn_player_id?: number | null;
  current_phase?: DuelPhase | null;
  turn_number: number;
  challenger_lp: number;
  opponent_lp: number;
  challenger_state?: PlayerBoardState | null;
  opponent_state?: PlayerBoardState | null;
  chat_log?: DuelChatMessage[];
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
  // Pile ou face (migration 010)
  coin_flip_winner_id?: number | null;
  coin_flip_choice?: 'P1' | 'P2' | null;
  phase_pre_game?: DuelPreGamePhase | null;
  // Chess-clock (migration 011)
  p1_clock_ms?: number;
  p2_clock_ms?: number;
  clock_started_at?: string | null;
  clock_running_for?: number | null;
  // Match Bo3 (migration 012)
  match_id?: number | null;
  game_number?: number;
  // Mode moteur (ygopro-core)
  engine_mode?: boolean;
}

// ─── Duel moteur (miroir de shared/duelView.ts) ────────────────────────

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

export interface DuelCardView {
  code: number;
  name?: string;
  description?: string;
  position?: number;
  faceDown: boolean;
  attack?: number;
  defense?: number;
  level?: number;
  materials?: number;
  counters?: Record<number, number>;
}
export type DuelZoneView = DuelCardView | null;

export interface DuelSideView {
  lp: number;
  monsters: DuelZoneView[];
  spells: DuelZoneView[];
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
  turnPlayer: DuelSeat;
  seat: DuelSeat;
  me: DuelSideView;
  opponent: DuelSideView;
  chainLength: number;
}

export type DuelPromptKind =
  | 'main' | 'battle' | 'cards' | 'place' | 'position' | 'confirm' | 'option'
  | 'chain' | 'sort' | 'announce' | 'select_counter' | 'announce_card'
  | 'select_card_codes' | 'unsupported';

export interface DuelPromptOption {
  id: string;
  label: string;
  code?: number;
  location?: number;
  sequence?: number;
  controller?: DuelSeat;
}
export interface DuelPrompt {
  kind: DuelPromptKind;
  seat: DuelSeat;
  message: string;
  options: DuelPromptOption[];
  min: number;
  max: number;
  canCancel: boolean;
  hint?: { title?: string; note?: string };
  counter?: {
    counterType: number;
    counterName: string;
    count: number;
    targets: Array<{
      targetIdx: number;
      cardCode: number;
      cardName: string;
      location?: number;
      sequence?: number;
      controller?: DuelSeat;
      currentCount: number;
    }>;
  };
  announce?: { hint?: string; searchable: boolean };
}
export interface DuelChoice {
  optionIds: string[];
  cancel?: boolean;
  counters?: Array<{ targetIdx: number; take: number }>;
  announcedCode?: number;
  cardCodes?: number[];
}

export interface DuelLogEntry { kind: string; text: string; codes?: number[]; }
export interface DuelCombatLogEntry {
  kind: string;
  description: string;
  at: number;
  forPlayers: DuelSeat | 'both';
  codes?: number[];
}
export interface DuelAnimationEvent {
  kind: string;
  description: string;
  codes?: number[];
  location?: number;
  sequence?: number;
  controller?: DuelSeat;
  toLocation?: number;
  toSequence?: number;
  toController?: DuelSeat;
  variant?: string;
  count?: number;
  forPlayers: DuelSeat | 'both';
  at: number;
  ttl: number;
}
export interface DuelReveal {
  code: number;
  name?: string;
  from: 'hand' | 'deck' | 'grave' | 'field' | 'extra' | 'decktop' | 'extratop' | 'unknown';
}
export interface DuelRevealBatch {
  forPlayer: DuelSeat;
  cards: DuelReveal[];
  at: number;
  ttl: number;
}
export interface DuelTossEvent {
  kind: 'coin' | 'dice';
  results: number[];
  byPlayer: DuelSeat;
  at: number;
  ttl: number;
}
export interface DuelClocks {
  p1Ms: number;
  p2Ms: number;
  runningFor: DuelSeat | null;
  serverNow: number;
}
export interface DuelStateResponse {
  duelId: number;
  status: 'awaiting_response' | 'ended' | 'stalled';
  board: DuelBoardView;
  prompt: DuelPrompt | null;
  log: DuelLogEntry[];
  winner?: DuelSeat | null;
  winReason?: string;
  lastRetry?: { at: number; note?: string };
  reveals?: DuelRevealBatch[];
  tosses?: DuelTossEvent[];
  combatLog?: DuelCombatLogEntry[];
  animations?: DuelAnimationEvent[];
  clocks?: DuelClocks;
}
export interface DuelPreGameState {
  phase: DuelPreGamePhase;
  playersReady: number[];
  winnerId: number | null;
  choice: 'P1' | 'P2' | null;
  firstPlayerId: number | null;
  choiceDeadlineAt: number | null;
}

export type DuelActionType =
  | 'draw'
  | 'place'
  | 'flip'
  | 'discard'
  | 'sendToGraveyard'
  | 'banish'
  | 'attack'
  | 'advance_phase'
  | 'end_turn'
  | 'surrender'
  | 'chat';

export interface DuelAction {
  type: DuelActionType;
  payload: any;
}

// ─── Actualites ─────────────────────────────────────────────
// Miroirs de shared/types/index.ts. Duplication assumee.

export type NewsTopic = 'tcg' | 'ocg' | 'competition' | 'releases' | 'banlist' | 'rulings';

export interface NewsItem {
  id: number;
  source_id: number;
  guid: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: string;
  topics: NewsTopic[];
  lang: string;
  source: {
    key: string;
    name: string;
    homepage: string | null;
  };
}

export interface NewsRelease {
  set_code: string;
  set_name: string;
  tcg_date: string; // "YYYY-MM-DD"
  num_of_cards: number;
}

export interface NewsTopicMeta {
  key: NewsTopic;
  label: string;
  description: string;
  subscribed: boolean;
}
