// Shared types between client and server

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User {
  id: number;
  username: string;
  email: string;
  profile_picture?: string;
  role?: UserRole;
  is_active?: boolean;
  disabled_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Card {
  id: number;
  card_id: string;
  name: string;
  /** Nom officiel Konami TCG français (via API YGOProDeck ?language=fr). Fallback = name. */
  name_fr?: string | null;
  /** Nom anglais canonique, disponible aussi via `name` quand la trad FR manque. */
  name_en?: string | null;
  type: string;
  frame_type: string;
  description: string;
  /** Description officielle Konami TCG français. Fallback = description. */
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
  created_at: Date;
  updated_at: Date;
}

export interface CardSet {
  set_name: string;
  set_code: string;
  set_rarity: string;
  set_rarity_code: string;
  set_price: string;
}

export interface CardImage {
  id: number;
  image_url: string;
  image_url_small: string;
  image_url_cropped?: string;
}

export interface BanlistInfo {
  ban_tcg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_ocg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_goat?: 'Banned' | 'Limited' | 'Semi-Limited';
}

/**
 * YGOProDeck renvoie les prix comme un tableau à 1 élément (chaînes de caractères en USD,
 * sauf Cardmarket qui est en EUR — c'est notre référence "Near Mint" marché européen).
 */
export interface CardPrices {
  cardmarket_price?: string;
  tcgplayer_price?: string;
  ebay_price?: string;
  amazon_price?: string;
  coolstuffinc_price?: string;
}

/** Stats agrégées d'une collection user, calculées côté serveur pour éviter N requêtes. */
export interface CollectionStats {
  total_cards: number;
  unique_cards: number;
  ultra_rares_count: number;
  secret_rares_count: number;
  total_value_eur: number;
  by_type: { monster: number; spell: number; trap: number; extra: number };
  recent_added_30d: number;
  /** Liste des raretés distinctes présentes dans la collection, triées par fréquence desc. */
  rarities: string[];
  /** Nombre de cartes (quantité cumulée) par rareté — sert à afficher la stat filtrée. */
  rarity_counts: Record<string, number>;
}

/** Stats agrégées d'un deck. */
export interface DeckStats {
  main_count: number;
  extra_count: number;
  side_count: number;
  main_by_type: { monster: number; spell: number; trap: number };
  total_value_eur: number;
  copies_count: number;
}

export type CardLanguage = 'EN' | 'FR' | 'DE' | 'IT' | 'PT' | 'SP' | 'JP' | 'KR';

export interface UserCard {
  id: number;
  user_id: number;
  card_id: number;
  set_code: string;
  rarity: string;
  language: CardLanguage;
  quantity: number;
  created_at: Date;
  updated_at: Date;
  card?: Card;
}

export interface Deck {
  id: number;
  user_id: number;
  name: string;
  cover_image?: string;
  is_public: boolean;
  respect_banlist: boolean;
  created_at: Date;
  updated_at: Date;
  user?: User;
  main_deck?: DeckCard[];
  extra_deck?: DeckCard[];
  likes_count?: number;
  dislikes_count?: number;
  comments_count?: number;
  user_reaction?: 'like' | 'dislike' | null;
  is_wishlisted?: boolean;
}

export interface DeckCard {
  id: number;
  deck_id: number;
  card_id: number;
  quantity: number;
  is_extra_deck: boolean;
  created_at: Date;
  card?: Card;
}

export interface Follow {
  id: number;
  follower_id: number;
  following_id: number;
  created_at: Date;
  follower?: User;
  following?: User;
}

export interface DeckWishlist {
  id: number;
  user_id: number;
  original_deck_id: number;
  created_at: Date;
  deck?: Deck;
}

export interface DeckReaction {
  id: number;
  user_id: number;
  deck_id: number;
  is_like: boolean;
  created_at: Date;
  updated_at: Date;
  user?: Partial<User>;
}

export interface DeckComment {
  id: number;
  user_id: number;
  deck_id: number;
  parent_comment_id?: number;
  content: string;
  created_at: Date;
  updated_at: Date;
  user?: Partial<User>;
  replies?: DeckComment[];
  replies_count?: number;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'follow' | 'like' | 'dislike' | 'comment' | 'reply';
  from_user_id?: number;
  deck_id?: number;
  comment_id?: number;
  is_read: boolean;
  created_at: Date;
  from_user?: Partial<User>;
  deck?: Partial<Deck>;
  comment?: DeckComment;
}

// API Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AddCardRequest {
  set_code: string;
  rarity: string;
  quantity?: number;
}

export interface CreateDeckRequest {
  name: string;
  respect_banlist: boolean;
  is_public: boolean;
}

export interface UpdateDeckRequest {
  name?: string;
  respect_banlist?: boolean;
  is_public?: boolean;
}

export interface AddCardToDeckRequest {
  card_id: number;
  quantity: number;
  is_extra_deck: boolean;
}

export interface CreateCommentRequest {
  content: string;
  parent_comment_id?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CollectionFilters extends PaginationParams {
  type?: string;
  frame_type?: string;
  rarity?: string;
  level?: number;
  min_atk?: number;
  max_atk?: number;
  min_def?: number;
  max_def?: number;
  attribute?: string;
  race?: string;
  card_id?: number;
}

export interface DeckFilters extends PaginationParams {
  user_id?: number;
  is_public?: boolean;
  respect_banlist?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ─── Duel types ─────────────────────────────────────────────────────────

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

/**
 * Une carte posee sur le plateau. faceDown = set / non revelee.
 * defenseMode s'applique aux monstres (attack vs defense position).
 */
export interface BoardCard {
  card: DeckCard;
  faceDown: boolean;
  defenseMode?: boolean;
}

/**
 * Etat de plateau d'un joueur.
 * - hand / deck / graveyard / banished : piles de DeckCard (chaque copie est atomique
 *   apres expansion des quantity).
 * - monsters / spellTraps : 5 slots fixes ordonnes.
 * - field : slot terrain unique.
 */
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
  challenger?: Partial<User>;
  opponent?: Partial<User>;
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
  created_at: Date;
  updated_at: Date;
  finished_at?: Date | null;
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

/**
 * Payload libre — chaque type d'action definit sa propre forme.
 * Le back valide au moment du traitement.
 *
 * Formes attendues (payload) :
 *  - draw:            { count?: number }                             (default 1)
 *  - place:           { fromHandIndex: number; zone: 'monster'|'spelltrap'|'field';
 *                       slotIndex?: number; faceDown?: boolean; defenseMode?: boolean }
 *  - flip:            { zone: 'monster'|'spelltrap'|'field'; slotIndex?: number;
 *                       defenseMode?: boolean }
 *  - discard:         { fromHandIndex: number }
 *  - sendToGraveyard: { zone: 'monster'|'spelltrap'|'field'|'hand'; slotIndex?: number }
 *  - banish:          { zone: 'monster'|'spelltrap'|'field'|'hand'|'graveyard'; slotIndex?: number }
 *  - attack:          { attackerSlot: number;
 *                       targetSlot: number | null }  // null = attaque directe
 *  - advance_phase:   {}
 *  - end_turn:        {}
 *  - surrender:       {}
 *  - chat:            { message: string }
 */
export interface DuelAction {
  type: DuelActionType;
  payload: any;
}

// ─── Actualités ─────────────────────────────────────────────

/**
 * Six thèmes exposés côté API. Miroir de `server/src/services/news/types.ts`.
 * L'union est explicite pour que TypeScript rejette une valeur inconnue en
 * clé de dictionnaire ou en filtre de topic.
 */
export type NewsTopic = 'tcg' | 'ocg' | 'competition' | 'releases' | 'banlist' | 'rulings';

/**
 * Un article tel que retourné par `GET /api/news`. Le corps n'est jamais
 * stocké : `url` renvoie toujours au site d'origine.
 */
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

/** Une extension TCG à venir ou récente — issue de YGOProDeck /cardsets.php. */
export interface NewsRelease {
  set_code: string;
  set_name: string;
  tcg_date: string; // "YYYY-MM-DD"
  num_of_cards: number;
}

/** Métadonnées d'un thème pour l'écran d'abonnement. */
export interface NewsTopicMeta {
  key: NewsTopic;
  label: string;
  description: string;
  subscribed: boolean;
}
