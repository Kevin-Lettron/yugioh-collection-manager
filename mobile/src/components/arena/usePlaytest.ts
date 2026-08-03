import { useCallback, useState } from 'react';
import type { DeckCard } from '@/types';

export type PlayMode = 'first' | 'second';
export type ZoneKind = 'monster' | 'spelltrap' | 'field';

/** Une carte posée sur le plateau + si elle l'est face verso (« set » en jargon YGO). */
export interface BoardCard {
  card: DeckCard;
  faceDown: boolean;
}

const EMPTY_ROW: Array<BoardCard | null> = [null, null, null, null, null];

/**
 * Machine à états du test de main, portée depuis client/src/pages/DeckView.tsx.
 *
 * L'état vit dans un hook plutôt que dans le composant du plateau : l'écran deck
 * en a besoin à deux endroits éloignés — le plateau, et le panneau de
 * probabilités affiché sous les commentaires.
 *
 * Règles reproduites : le joueur qui commence pioche 5 cartes (pas de pioche au
 * premier tour), le second 6. Zones : 5 monstres, 5 magies/pièges, 1 terrain.
 */
export function usePlaytest(mainDeck: DeckCard[]) {
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [handCards, setHandCards] = useState<DeckCard[]>([]);
  const [deckPile, setDeckPile] = useState<DeckCard[]>([]);
  const [graveyard, setGraveyard] = useState<DeckCard[]>([]);
  const [banished, setBanished] = useState<DeckCard[]>([]);
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  const [boardMonsters, setBoardMonsters] = useState<Array<BoardCard | null>>(EMPTY_ROW);
  const [boardSpellTraps, setBoardSpellTraps] = useState<Array<BoardCard | null>>(EMPTY_ROW);
  const [boardField, setBoardField] = useState<BoardCard | null>(null);
  /** Si actif, la prochaine carte posée le sera face verso. Remis à zéro après la pose. */
  const [nextFaceDown, setNextFaceDown] = useState(false);
  /**
   * Message d'erreur ou d'information affiché sous le plateau.
   *
   * Le web utilise des toasts ; ici un bandeau inline évite d'empiler des
   * `Alert.alert` modaux pour un simple « zone occupée », qui couperaient le
   * rythme du test à chaque tap maladroit.
   */
  const [notice, setNotice] = useState<string | null>(null);

  const clearBoard = useCallback(() => {
    setBoardMonsters(EMPTY_ROW);
    setBoardSpellTraps(EMPTY_ROW);
    setBoardField(null);
    setSelectedHandIdx(null);
    setNextFaceDown(false);
  }, []);

  const startHand = useCallback(
    (mode: PlayMode) => {
      const expanded = expandDeck(mainDeck);
      if (expanded.length === 0) {
        setNotice('Le deck principal est vide.');
        return;
      }
      const shuffled = shuffleArr(expanded);
      const size = mode === 'first' ? 5 : 6;
      setHandCards(shuffled.slice(0, size));
      setDeckPile(shuffled.slice(size));
      setGraveyard([]);
      setBanished([]);
      clearBoard();
      setPlayMode(mode);
      setNotice(null);
    },
    [mainDeck, clearBoard]
  );

  const resetHand = useCallback(() => {
    setPlayMode(null);
    setHandCards([]);
    setDeckPile([]);
    setGraveyard([]);
    setBanished([]);
    clearBoard();
    setNotice(null);
  }, [clearBoard]);

  const drawOne = useCallback(() => {
    if (deckPile.length === 0) {
      setNotice('Deck vide — deck out !');
      return;
    }
    setHandCards((h) => [...h, deckPile[0]]);
    setDeckPile((d) => d.slice(1));
    setNotice(null);
  }, [deckPile]);

  const selectHand = useCallback((idx: number | null) => {
    setSelectedHandIdx((cur) => (cur === idx ? null : idx));
    setNotice(null);
  }, []);

  /** Pose la carte sélectionnée de la main sur la zone donnée. */
  const placeOnBoard = useCallback(
    (kind: ZoneKind, slotIdx: number) => {
      if (selectedHandIdx === null) return;
      const dc = handCards[selectedHandIdx];
      if (!dc) return;

      const cardKind = zoneKindOf(dc);
      if (cardKind !== kind) {
        setNotice(
          `« ${cardName(dc)} » ne peut pas aller ici (attendu : ${ZONE_KIND_LABELS[kind]}).`
        );
        return;
      }

      const posed: BoardCard = { card: dc, faceDown: nextFaceDown };

      if (kind === 'monster') {
        if (boardMonsters[slotIdx]) {
          setNotice('Zone occupée — tape la carte pour la retourner, ou ✕ pour la défausser.');
          return;
        }
        setBoardMonsters((row) => row.map((c, i) => (i === slotIdx ? posed : c)));
      } else if (kind === 'spelltrap') {
        if (boardSpellTraps[slotIdx]) {
          setNotice('Zone occupée — tape la carte pour la retourner, ou ✕ pour la défausser.');
          return;
        }
        setBoardSpellTraps((row) => row.map((c, i) => (i === slotIdx ? posed : c)));
      } else {
        // Un nouveau terrain détruit l'ancien (règle YGO).
        if (boardField) setGraveyard((g) => [...g, boardField.card]);
        setBoardField(posed);
      }

      setHandCards((h) => h.filter((_, i) => i !== selectedHandIdx));
      setSelectedHandIdx(null);
      setNextFaceDown(false);
      setNotice(null);
    },
    [selectedHandIdx, handCards, nextFaceDown, boardMonsters, boardSpellTraps, boardField]
  );

  /** Retourne la carte posée dans une zone (face visible ↔ face verso). */
  const flipZone = useCallback((kind: ZoneKind, slotIdx: number) => {
    const flip = (c: BoardCard | null) => (c ? { ...c, faceDown: !c.faceDown } : c);
    if (kind === 'monster') {
      setBoardMonsters((row) => row.map((c, i) => (i === slotIdx ? flip(c) : c)));
    } else if (kind === 'spelltrap') {
      setBoardSpellTraps((row) => row.map((c, i) => (i === slotIdx ? flip(c) : c)));
    } else {
      setBoardField(flip);
    }
  }, []);

  /** Envoie au cimetière la carte de la zone et libère celle-ci. */
  const clearZone = useCallback(
    (kind: ZoneKind, slotIdx: number) => {
      const occupant =
        kind === 'monster'
          ? boardMonsters[slotIdx]
          : kind === 'spelltrap'
            ? boardSpellTraps[slotIdx]
            : boardField;
      if (!occupant) return;

      setGraveyard((g) => [...g, occupant.card]);
      if (kind === 'monster') {
        setBoardMonsters((row) => row.map((c, i) => (i === slotIdx ? null : c)));
      } else if (kind === 'spelltrap') {
        setBoardSpellTraps((row) => row.map((c, i) => (i === slotIdx ? null : c)));
      } else {
        setBoardField(null);
      }
    },
    [boardMonsters, boardSpellTraps, boardField]
  );

  const sendToGraveyard = useCallback(
    (fromIndex: number) => {
      const c = handCards[fromIndex];
      if (!c) return;
      setGraveyard((g) => [...g, c]);
      setHandCards((h) => h.filter((_, i) => i !== fromIndex));
      setSelectedHandIdx(null);
      setNotice(null);
    },
    [handCards]
  );

  const banishFromHand = useCallback(
    (fromIndex: number) => {
      const c = handCards[fromIndex];
      if (!c) return;
      setBanished((b) => [...b, c]);
      setHandCards((h) => h.filter((_, i) => i !== fromIndex));
      setSelectedHandIdx(null);
      setNotice(null);
    },
    [handCards]
  );

  return {
    playMode,
    handCards,
    deckPile,
    graveyard,
    banished,
    selectedHandIdx,
    boardMonsters,
    boardSpellTraps,
    boardField,
    nextFaceDown,
    notice,
    active: playMode !== null,
    setNextFaceDown,
    selectHand,
    startHand,
    resetHand,
    drawOne,
    placeOnBoard,
    flipZone,
    clearZone,
    sendToGraveyard,
    banishFromHand,
    dismissNotice: useCallback(() => setNotice(null), []),
  };
}

export type Playtest = ReturnType<typeof usePlaytest>;

export const ZONE_KIND_LABELS: Record<ZoneKind, string> = {
  monster: 'monstre',
  spelltrap: 'magie/piège',
  field: 'terrain',
};

export const cardName = (dc: DeckCard | null | undefined): string =>
  dc?.card?.name_fr || dc?.card?.name || `Carte #${dc?.card_id ?? '?'}`;

export const cardArt = (dc: DeckCard | null | undefined): string | undefined =>
  dc?.card?.card_images?.[0]?.image_url_small || dc?.card?.card_images?.[0]?.image_url;

/** Renvoie la zone du plateau qui accepte cette carte, ou null si indéterminé. */
export function zoneKindOf(dc: DeckCard | null | undefined): ZoneKind | null {
  const t = (dc?.card?.type || '').toLowerCase();
  if (!t) return null;
  // « Field Spell » : le type le dit parfois, sinon c'est `race` qui porte
  // l'information côté YGOProDeck.
  if (t.includes('field') || (t.includes('spell') && dc?.card?.race?.toLowerCase() === 'field')) {
    return 'field';
  }
  if (t.includes('monster')) return 'monster';
  if (t.includes('spell') || t.includes('trap')) return 'spelltrap';
  return null;
}

export function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Explose chaque DeckCard en `quantity` instances : le mélange manipule des unités atomiques. */
export function expandDeck(cards: DeckCard[]): DeckCard[] {
  return cards.flatMap((dc) => Array.from({ length: dc.quantity }, () => ({ ...dc, quantity: 1 })));
}
