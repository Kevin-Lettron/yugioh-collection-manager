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

export interface BanlistInfo {
  ban_tcg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_ocg?: 'Banned' | 'Limited' | 'Semi-Limited';
  ban_goat?: 'Banned' | 'Limited' | 'Semi-Limited';
}

export interface Card {
  id: number;
  card_id: string;
  name: string;
  type: string;
  frame_type?: string;
  description?: string;
  atk?: number;
  def?: number;
  level?: number;
  race?: string;
  attribute?: string;
  archetype?: string;
  card_sets?: CardSet[];
  card_images?: CardImage[];
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
