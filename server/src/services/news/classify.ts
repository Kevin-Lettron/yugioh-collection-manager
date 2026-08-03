/**
 * Classification d'un article — deux passes pour ne rien laisser filer.
 *
 * Les catégories déclarées par le flux sont le signal le plus fiable, mais tous
 * les flux ne les remplissent pas (Reddit envoie souvent des articles nus). Un
 * second passage sur le titre attrape ce que la source a oublié — banlist,
 * tournoi, ruling, spoiler — sans jamais inventer un thème là où le mot n'est
 * pas.
 *
 * Si les deux passes ne trouvent rien :
 *   - source stricte (`requires_topic_match`) → l'article est écarté ;
 *   - sinon → on retombe sur `default_topics` déclarés par la source.
 */

import type { NewsSourceRow, NewsTopic, RawNewsItem } from './types';
import { isNewsTopic } from './types';

/** Table des catégories connues, en clef normalisée (lower-case, trim). */
const CATEGORY_MAP: Record<string, NewsTopic> = {
  // Banlist
  'banlist': 'banlist',
  'forbidden & limited': 'banlist',
  'forbidden and limited': 'banlist',
  // Rulings
  'ruling': 'rulings',
  'rulings': 'rulings',
  'judge': 'rulings',
  // OCG
  'ocg': 'ocg',
  'english ocg': 'ocg',
  // TCG
  'yugioh': 'tcg',
  'tcg': 'tcg',
  'news': 'tcg',
  'rush duel': 'tcg',
  'speed duel': 'tcg',
  // Releases
  'new cards': 'releases',
  'reprints': 'releases',
  // Competition
  'regional': 'competition',
  'ycs': 'competition',
  'tournament': 'competition',
  'top 32': 'competition',
  'top 16': 'competition',
  'top 8': 'competition',
};

/** Mots-clés du titre — filet de sécurité quand les catégories sont muettes. */
const TITLE_PATTERNS: Array<{ re: RegExp; topic: NewsTopic }> = [
  { re: /\bbanlist\b/i, topic: 'banlist' },
  { re: /forbidden.*limited/i, topic: 'banlist' },
  { re: /\bycs\b/i, topic: 'competition' },
  { re: /\bregional\b/i, topic: 'competition' },
  { re: /top \d+/i, topic: 'competition' },
  { re: /tournament/i, topic: 'competition' },
  { re: /ruling/i, topic: 'rulings' },
  { re: /interaction/i, topic: 'rulings' },
  { re: /reveal/i, topic: 'releases' },
  { re: /leak/i, topic: 'releases' },
  { re: /preview/i, topic: 'releases' },
  { re: /spoiler/i, topic: 'releases' },
];

export function classifyArticle(
  raw: RawNewsItem,
  source: NewsSourceRow
): NewsTopic[] {
  const found = new Set<NewsTopic>();

  // Passe 1 — catégories du flux.
  for (const cat of raw.categories) {
    const key = cat.trim().toLowerCase();
    const topic = CATEGORY_MAP[key];
    if (topic) found.add(topic);
  }

  // Passe 2 — mots-clés du titre. Toujours exécutée : un article marqué
  // "TCG" par la source peut aussi être une banlist, et on veut les deux.
  for (const { re, topic } of TITLE_PATTERNS) {
    if (re.test(raw.title)) found.add(topic);
  }

  if (found.size > 0) return Array.from(found);

  // Aucun thème reconnu — la source décide du sort.
  if (source.requires_topic_match) return [];

  return source.default_topics.filter(isNewsTopic);
}
