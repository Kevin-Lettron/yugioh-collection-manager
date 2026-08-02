import type { Card } from '@/types';

/**
 * Renvoie le nom FR officiel Konami TCG si dispo, sinon le nom EN.
 * A utiliser partout ou on affiche un nom de carte.
 */
export function cardName(card?: Pick<Card, 'name' | 'name_fr'> | null): string {
  if (!card) return '';
  return card.name_fr || card.name || '';
}

/** Renvoie la description FR si dispo, sinon la description EN. */
export function cardDescription(card?: Pick<Card, 'description' | 'description_fr'> | null): string {
  if (!card) return '';
  return card.description_fr || card.description || '';
}
