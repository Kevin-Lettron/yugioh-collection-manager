/**
 * Classification Main Deck / Extra Deck — source unique pour le web et le serveur.
 *
 * Historique du bug que ce fichier corrige : trois implémentations coexistaient,
 * avec des critères différents.
 *
 *   - Le serveur testait `frame_type` contre ['fusion','synchro','xyz','link'].
 *   - Le client testait `type` contre une liste fermée de quatre libellés exacts.
 *   - Le mobile testait `type` par sous-chaîne, sur les premiers mots de la liste.
 *
 * Or `type` est une chaîne descriptive qui se décline à l'infini côté YGOProDeck :
 * « Synchro Tuner Monster », « Pendulum Effect Fusion Monster », « XYZ Pendulum
 * Effect Monster »… Une comparaison exacte en rate la moitié. Résultat : le client
 * laissait ajouter un Formula Synchron au Main Deck, et le serveur refusait la
 * sauvegarde — « Extra Deck monsters must be added to Extra Deck », deck bloqué.
 *
 * `frame_type` est le bon critère : champ normalisé, quatre valeurs possibles pour
 * l'Extra Deck. `type` ne sert que de repli pour les cartes en base dont le champ
 * n'est pas renseigné.
 */

/** Valeurs de `frame_type` correspondant à une carte d'Extra Deck. */
export const EXTRA_DECK_FRAMES = ['fusion', 'synchro', 'xyz', 'link'] as const;

/**
 * Repli sur `type`. On cherche le mot-clé d'invocation, pas un libellé exact.
 *
 * `pendulum` est volontairement absent : une « Pendulum Effect Monster » est une
 * carte de **Main Deck**. Seules les Pendulum également Fusion/Synchro/Xyz vont
 * dans l'Extra, et celles-là contiennent déjà le mot-clé correspondant.
 */
const EXTRA_DECK_TYPE_KEYWORDS = ['fusion', 'synchro', 'xyz', 'link'];

export interface ClassifiableCard {
  type?: string | null;
  frame_type?: string | null;
  /** Certaines API et le mobile exposent la version camelCase. */
  frameType?: string | null;
}

/**
 * `true` si la carte va dans l'Extra Deck.
 *
 * Attention au cas des monstres Lien : leur `type` est « Link Monster », mais
 * un monstre normal dont le nom contiendrait « link » n'est pas concerné — on
 * teste bien le champ `type`, jamais le nom de la carte.
 */
export function isExtraDeckCard(card: ClassifiableCard | null | undefined): boolean {
  if (!card) return false;

  const frame = (card.frame_type ?? card.frameType ?? '').toLowerCase().trim();
  if (frame) {
    return (EXTRA_DECK_FRAMES as readonly string[]).includes(frame);
  }

  const type = (card.type ?? '').toLowerCase();
  if (!type) return false;
  return EXTRA_DECK_TYPE_KEYWORDS.some((keyword) => type.includes(keyword));
}

/** Inverse, pour la lisibilité des filtres. */
export function isMainDeckCard(card: ClassifiableCard | null | undefined): boolean {
  return !isExtraDeckCard(card);
}
