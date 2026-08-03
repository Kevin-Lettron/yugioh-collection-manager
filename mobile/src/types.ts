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

export type DuelStatus = 'pending' | 'active' | 'finished' | 'cancelled';
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
