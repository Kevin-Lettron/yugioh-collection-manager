import type { Deck, DeckCard } from '../../../../shared/types';
import { isExtraDeckCard } from '../../../../shared/cards';
import { query } from '../../config/database';
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
/**
 * Traduit une **soumission de side-deck** en `EnginePlayerDeck`.
 *
 * `mainIds` / `extraIds` sont des `cards.id` (la clé interne du catalogue), pas
 * des passcodes. On les résout d'un seul `SELECT ... IN (…)` pour éviter N
 * requêtes, puis on aplatit selon le nombre d'occurrences dans la liste (une
 * carte peut apparaître plusieurs fois dans une composition en tant qu'entrées
 * atomiques).
 *
 * F4 · le format de compétition YGO — chaque manche redémarre avec la
 * composition retenue par le joueur, main + side confondus.
 */
export async function buildEngineDeckFromIds(
  mainIds: number[],
  extraIds: number[]
): Promise<DeckConversion> {
  const store = getCardStore();
  const uniqueIds = [...new Set([...mainIds, ...extraIds])];
  if (uniqueIds.length === 0) {
    return {
      deck: { main: [], extra: [] },
      rejected: [{ name: '(vide)', code: '-', reason: 'aucune carte soumise' }],
    };
  }
  const res = await query(
    `SELECT id, card_id, name, name_fr, frame_type, type
       FROM cards
      WHERE id = ANY($1::int[])`,
    [uniqueIds]
  );
  // Table des cartes par id interne, avec passcode et frameType nécessaires.
  const byId = new Map<number, { code: number; name: string; frame_type?: string; type?: string }>();
  for (const r of res.rows) {
    const code = Number(r.card_id);
    byId.set(r.id, {
      code: Number.isInteger(code) && code > 0 ? code : 0,
      name: r.name_fr || r.name || `carte #${r.id}`,
      frame_type: r.frame_type,
      type: r.type,
    });
  }

  const main: number[] = [];
  const extra: number[] = [];
  const rejected: DeckConversion['rejected'] = [];

  const push = (
    id: number,
    forcedExtra: boolean
  ): void => {
    const row = byId.get(id);
    if (!row) {
      rejected.push({
        name: `carte #${id}`,
        code: String(id),
        reason: 'carte introuvable en base',
      });
      return;
    }
    if (!row.code) {
      rejected.push({
        name: row.name,
        code: String(id),
        reason: 'passcode absent en base',
      });
      return;
    }
    if (!resolveCard(row.code, store)) {
      rejected.push({
        name: row.name,
        code: String(row.code),
        reason: 'inconnue du moteur',
      });
      return;
    }
    // Sécurité : on vérifie que le classement soumis correspond bien au type
    // réel. Un side-deck qui rangerait un Fusion dans le Main planterait le moteur.
    const actuallyExtra = isExtraDeckCard(row);
    if (forcedExtra && !actuallyExtra) {
      rejected.push({
        name: row.name,
        code: String(row.code),
        reason: 'carte non-Extra rangée dans l\'Extra',
      });
      return;
    }
    if (!forcedExtra && actuallyExtra) {
      rejected.push({
        name: row.name,
        code: String(row.code),
        reason: 'carte Extra rangée dans le Main',
      });
      return;
    }
    (forcedExtra ? extra : main).push(row.code);
  };

  for (const id of mainIds) push(id, false);
  for (const id of extraIds) push(id, true);

  return { deck: { main, extra }, rejected };
}

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
