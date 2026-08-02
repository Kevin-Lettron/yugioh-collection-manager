import type { CardPrices, Deck, DeckStats } from '../../../shared/types';

/**
 * Extrait le prix Cardmarket (EUR, Near Mint approx.) du champ card_prices YGOProDeck.
 * Retourne null si la carte n'a jamais été indexée par Cardmarket.
 */
export function cardmarketPriceEUR(prices?: CardPrices[] | null): number | null {
  if (!prices || !Array.isArray(prices) || prices.length === 0) return null;
  const raw = prices[0]?.cardmarket_price;
  if (!raw) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Somme des valeurs Cardmarket × quantité, en euros. Cartes sans prix comptent 0. */
export function totalValueEUR(
  items: Array<{ quantity: number; card?: { card_prices?: CardPrices[] } }>
): number {
  return items.reduce((acc, it) => {
    const p = cardmarketPriceEUR(it.card?.card_prices);
    return p ? acc + p * (it.quantity || 1) : acc;
  }, 0);
}

/** Rareté "Ultra Rare" et variantes. Case-insensitive, matche aussi "Ultra Pharaoh's Rare" etc. */
export function isUltraRare(rarity?: string | null): boolean {
  if (!rarity) return false;
  return /\bultra\b/i.test(rarity);
}

/** Rareté "Secret Rare" et variantes (Prismatic Secret, Ultimate Secret…). */
export function isSecretRare(rarity?: string | null): boolean {
  if (!rarity) return false;
  return /\bsecret\b|\bultimate\b/i.test(rarity);
}

/** Stats agrégées pour un deck déjà chargé (main_deck + extra_deck côté serveur). */
export function computeDeckStats(deck: Deck, copiesCount = 0): DeckStats {
  const main = deck.main_deck || [];
  const extra = deck.extra_deck || [];

  const main_by_type = { monster: 0, spell: 0, trap: 0 };
  let main_count = 0;
  for (const dc of main) {
    const qty = dc.quantity || 0;
    main_count += qty;
    const t = (dc.card?.type || '').toLowerCase();
    if (t.includes('spell')) main_by_type.spell += qty;
    else if (t.includes('trap')) main_by_type.trap += qty;
    else main_by_type.monster += qty;
  }

  const extra_count = extra.reduce((s, dc) => s + (dc.quantity || 0), 0);
  const total_value_eur =
    Math.round(
      ([...main, ...extra].reduce((acc, dc) => {
        const p = cardmarketPriceEUR(dc.card?.card_prices);
        return p ? acc + p * (dc.quantity || 0) : acc;
      }, 0)) * 100
    ) / 100;

  return {
    main_count,
    extra_count,
    side_count: 0,
    main_by_type,
    total_value_eur,
    copies_count: copiesCount,
  };
}
