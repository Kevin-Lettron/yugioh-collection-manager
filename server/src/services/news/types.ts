/**
 * Vocabulaire des actualités, partagé par l'ingestion et l'API.
 *
 * Six thèmes, pas plus : au-delà, personne ne configure rien.
 */
export const NEWS_TOPICS = [
  'tcg',
  'ocg',
  'competition',
  'releases',
  'banlist',
  'rulings',
] as const;

export type NewsTopic = (typeof NEWS_TOPICS)[number];

export const NEWS_TOPIC_LABELS: Record<NewsTopic, string> = {
  tcg: 'TCG mondial',
  ocg: 'OCG japonais',
  competition: 'Compétition',
  releases: 'Sorties de cartes',
  banlist: 'Banlist',
  rulings: 'Règles et jugements',
};

export const NEWS_TOPIC_DESCRIPTIONS: Record<NewsTopic, string> = {
  tcg: 'Annonces officielles, produits et règles du circuit occidental.',
  ocg: 'Nouveautés japonaises, souvent en avance de plusieurs mois sur le TCG.',
  competition: 'Tournois, résultats et decks du méta.',
  releases: 'Nouvelles cartes, extensions et réimpressions.',
  banlist: 'Listes limitatives et cartes interdites.',
  rulings: 'Interactions de cartes et jugements officiels.',
};

export function isNewsTopic(value: unknown): value is NewsTopic {
  return typeof value === 'string' && (NEWS_TOPICS as readonly string[]).includes(value);
}

/** Un article, sous la forme unique produite par le parseur. */
export interface RawNewsItem {
  guid: string;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  /** Catégories déclarées par le flux — le signal le plus fiable pour classer. */
  categories: string[];
}

export interface NewsSourceRow {
  id: number;
  key: string;
  name: string;
  feed_url: string;
  homepage: string | null;
  default_topics: string[];
  requires_topic_match: boolean;
  enabled: boolean;
  min_interval_minutes: number;
  last_fetch_at: Date | null;
  last_success_at: Date | null;
  last_error: string | null;
  consecutive_failures: number;
}

export interface NewsItemRow {
  id: number;
  source_id: number;
  guid: string;
  url: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  published_at: Date;
  topics: string[];
  lang: string;
}
