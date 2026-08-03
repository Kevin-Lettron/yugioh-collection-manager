import type { Deck, DeckCard } from '../../../../shared/types';
import { isExtraDeckCard } from '../../../../shared/cards';
import { getCardStore, resolveCard } from './cardStore';
import type { EnginePlayerDeck } from './protocol';

/**
 * Traduit un deck de la base en liste de passcodes pour le moteur.
 *
 * **Le piège qui fait tout rater si on l'ignore** : `deck_cards.card_id`
 * référence `cards.id`, notre clé primaire interne. Le passcode Konami — le seul
 * identifiant que le moteur comprenne — est dans `cards.card_id`, une colonne
 * texte. Confondre les deux donne un deck de cartes inexistantes, et le moteur
 * répond par un silence : il refuse de démarrer sans dire pourquoi.
 */

export interface DeckConversion {
  deck: EnginePlayerDeck;
  /** Cartes que le moteur ne connaît pas, nommées pour être affichables. */
  rejected: Array<{ name: string; code: string; reason: string }>;
}

function passcodeOf(dc: DeckCard): number | null {
  const raw = dc.card?.card_id;
  if (raw === undefined || raw === null) return null;
  const code = Number(raw);
  return Number.isInteger(code) && code > 0 ? code : null;
}

function nameOf(dc: DeckCard): string {
  return dc.card?.name_fr || dc.card?.name || `carte #${dc.card_id}`;
}

/**
 * Construit les deux listes attendues par le moteur.
 *
 * Le classement Main / Extra suit **le type réel de la carte** et non le drapeau
 * `is_extra_deck` stocké en base : le moteur refuse un monstre Fusion posé dans
 * le Main Deck, et une donnée incohérente en base ne doit pas se traduire par
 * un duel impossible à lancer.
 */
export function deckToEngine(deck: Deck): DeckConversion {
  const store = getCardStore();
  const main: number[] = [];
  const extra: number[] = [];
  const rejected: DeckConversion['rejected'] = [];

  const entries = [...(deck.main_deck ?? []), ...(deck.extra_deck ?? [])];

  for (const dc of entries) {
    const code = passcodeOf(dc);
    if (code === null) {
      rejected.push({
        name: nameOf(dc),
        code: String(dc.card?.card_id ?? '?'),
        reason: 'passcode absent ou invalide en base',
      });
      continue;
    }

    if (!resolveCard(code, store)) {
      rejected.push({
        name: nameOf(dc),
        code: String(code),
        reason: 'inconnue du moteur — cards.cdb à mettre à jour',
      });
      continue;
    }

    const target = dc.card && isExtraDeckCard(dc.card) ? extra : main;
    for (let i = 0; i < Math.max(1, dc.quantity); i++) {
      target.push(code);
    }
  }

  return { deck: { main, extra }, rejected };
}

/**
 * Contrôle de recevabilité minimal, avant d'engager le moteur.
 *
 * Ce n'est pas la validation de format complète (banlist, limites par carte) —
 * elle viendra à l'étape 7. On vérifie seulement ce sans quoi le moteur ne peut
 * pas démarrer.
 */
export function checkEngineDeck(conversion: DeckConversion): string | null {
  const { main, extra } = conversion.deck;

  if (conversion.rejected.length) {
    const names = conversion.rejected.slice(0, 3).map((r) => r.name).join(', ');
    const more = conversion.rejected.length > 3 ? ` (+${conversion.rejected.length - 3})` : '';
    return `Cartes non jouables : ${names}${more}`;
  }
  if (main.length < 40) return `Deck principal incomplet : ${main.length} cartes sur 40 minimum`;
  if (main.length > 60) return `Deck principal trop grand : ${main.length} cartes sur 60 maximum`;
  if (extra.length > 15) return `Extra Deck trop grand : ${extra.length} cartes sur 15 maximum`;

  return null;
}
