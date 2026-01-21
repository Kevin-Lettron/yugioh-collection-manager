// Shared types between client and server

export interface User {
  id: number;
  username: string;
  email: string;
  profile_picture?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Card {
  id: number;
  card_id: string;
  name: string;
  type: string;
  frame_type: string;
  description: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string;
  card_sets?: CardSet[];
  card_images?: CardImage[];
  card_prices?: any;
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
