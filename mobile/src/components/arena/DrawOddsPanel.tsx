import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme } from '@/theme/ThemeContext';
import type { DeckCard } from '@/types';
import { atLeastOne, handProbability, formatOdds } from '@/utils/drawOdds';
import { cardName } from './usePlaytest';

interface DrawOddsPanelProps {
  /** Composition initiale du Main Deck (avant la première pioche). */
  mainDeck: DeckCard[];
  /** Cartes encore dans la pioche — se vide au fil du test. */
  deckPile: DeckCard[];
  /** Main courante. */
  handCards: DeckCard[];
  /** true si un test est en cours. */
  active: boolean;
}

interface Row {
  key: string;
  name: string;
  inDeckInitial: number;
  remaining: number;
  inHand: number;
  next1: number;
  next3: number;
  next5: number;
}

const countBy = (list: DeckCard[]) => {
  const m = new Map<number, number>();
  for (const dc of list) m.set(dc.card_id, (m.get(dc.card_id) || 0) + dc.quantity);
  return m;
};

/**
 * Probabilités de pioche, recalculées à chaque changement d'état du test.
 *
 * Deux informations distinctes :
 *   - par carte, la chance de la piocher dans les prochains tirages, sur la
 *     pioche **restante** — c'est ce qui bouge à chaque pioche ;
 *   - pour la main courante, la probabilité d'être tombé exactement dessus,
 *     calculée sur la composition **initiale** du deck.
 *
 * Miroir de client/src/components/DrawOddsPanel.tsx.
 */
export default function DrawOddsPanel({
  mainDeck,
  deckPile,
  handCards,
  active,
}: DrawOddsPanelProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [sort, setSort] = useState<'odds' | 'name'>('odds');
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const initialSize = useMemo(
    () => mainDeck.reduce((sum, dc) => sum + dc.quantity, 0),
    [mainDeck]
  );

  const rows = useMemo<Row[]>(() => {
    // La pioche manipule des instances atomiques (une entrée par exemplaire),
    // l'affichage veut une ligne par carte : on regroupe par identifiant.
    const remainingBy = countBy(deckPile);
    const handBy = countBy(handCards);
    const pileSize = deckPile.reduce((s, dc) => s + dc.quantity, 0);

    const out = mainDeck.map<Row>((dc) => {
      const remaining = active ? remainingBy.get(dc.card_id) || 0 : dc.quantity;
      const pool = active ? pileSize : initialSize;
      return {
        key: String(dc.card_id),
        name: cardName(dc),
        inDeckInitial: dc.quantity,
        remaining,
        inHand: handBy.get(dc.card_id) || 0,
        next1: atLeastOne(remaining, pool, 1),
        next3: atLeastOne(remaining, pool, 3),
        next5: atLeastOne(remaining, pool, 5),
      };
    });

    const filtered = onlyRemaining ? out.filter((r) => r.remaining > 0) : out;

    return filtered.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'fr')
        : b.next1 - a.next1 || a.name.localeCompare(b.name, 'fr')
    );
  }, [mainDeck, deckPile, handCards, active, initialSize, sort, onlyRemaining]);

  /** Probabilité d'avoir tiré exactement cette main depuis le deck de départ. */
  const currentHandOdds = useMemo(() => {
    if (!active || handCards.length === 0) return null;

    const initialBy = countBy(mainDeck);
    const handBy = countBy(handCards);

    const entries = [...handBy.entries()].map(([cardId, inHand]) => ({
      inHand,
      inDeck: initialBy.get(cardId) || 0,
    }));

    return handProbability(entries, initialSize);
  }, [active, handCards, mainDeck, initialSize]);

  const handSize = handCards.reduce((s, dc) => s + dc.quantity, 0);
  const pileSize = deckPile.reduce((s, dc) => s + dc.quantity, 0);

  const oddsColor = (p: number, exhausted: boolean) =>
    exhausted ? colors.textDim : p >= 0.5 ? colors.gold : p >= 0.2 ? colors.text : colors.textMuted;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Probabilités de pioche</Text>
        <View style={styles.headerSep} />
      </View>

      <Text style={styles.intro}>
        {active
          ? `Calculé sur les ${pileSize} cartes restantes — mis à jour à chaque pioche.`
          : `Calculé sur le deck complet (${initialSize} cartes). Lance un test pour suivre l'évolution.`}
      </Text>

      {currentHandOdds !== null && (
        <View style={styles.handBox}>
          <Text style={styles.handLabel}>Cette main précise</Text>
          <Text style={styles.handValue}>{formatOdds(currentHandOdds)}</Text>
          <Text style={styles.handHint}>
            Chance de tirer exactement ces {handSize} cartes depuis un deck de {initialSize}.
            L&apos;ordre ne compte pas.
          </Text>
        </View>
      )}

      <View style={styles.chipRow}>
        <TouchableOpacity
          onPress={() => setSort(sort === 'odds' ? 'name' : 'odds')}
          style={styles.chip}>
          <Text style={styles.chipText}>
            Tri : {sort === 'odds' ? 'probabilité' : 'nom'}
          </Text>
        </TouchableOpacity>
        {active && (
          <TouchableOpacity
            onPress={() => setOnlyRemaining((v) => !v)}
            style={[styles.chip, onlyRemaining && styles.chipOn]}>
            <Text style={[styles.chipText, onlyRemaining && styles.chipTextOn]}>
              {onlyRemaining ? '✓ ' : ''}Masquer les épuisées
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tableHead}>
        <Text style={[styles.th, styles.colName]}>Carte</Text>
        <Text style={[styles.th, styles.colLeft]}>Reste</Text>
        <Text style={[styles.th, styles.colOdds]}>+1</Text>
        <Text style={[styles.th, styles.colOdds]}>+3</Text>
        <Text style={[styles.th, styles.colOdds]}>+5</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>Aucune carte à afficher.</Text>
      ) : (
        rows.map((r) => {
          const exhausted = active && r.remaining === 0;
          return (
            <View key={r.key} style={styles.tr}>
              <View style={styles.colName}>
                <Text
                  style={[styles.cardNameText, exhausted && styles.cardNameExhausted]}
                  numberOfLines={2}>
                  {r.name}
                </Text>
                {r.inHand > 0 && <Text style={styles.inHand}>EN MAIN ×{r.inHand}</Text>}
              </View>
              <Text style={[styles.td, styles.colLeft, { color: colors.textMuted }]}>
                {r.remaining}/{r.inDeckInitial}
              </Text>
              <Text style={[styles.td, styles.colOdds, { color: oddsColor(r.next1, exhausted) }]}>
                {formatOdds(r.next1)}
              </Text>
              <Text style={[styles.td, styles.colOdds, { color: oddsColor(r.next3, exhausted) }]}>
                {formatOdds(r.next3)}
              </Text>
              <Text style={[styles.td, styles.colOdds, { color: oddsColor(r.next5, exhausted) }]}>
                {formatOdds(r.next5)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 16,
      marginTop: 20,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heading: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: t.type.trackingWide,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },
    headerSep: { flex: 1, height: 1, backgroundColor: t.colors.border },
    intro: { fontSize: 12, color: t.colors.textMuted, marginTop: 6, marginBottom: 14 },

    handBox: {
      borderLeftWidth: 2,
      borderLeftColor: t.colors.cyan,
      backgroundColor: t.colors.panel2,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 14,
    },
    handLabel: {
      fontSize: 10,
      letterSpacing: t.type.tracking,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
      fontWeight: '600',
    },
    handValue: { fontSize: 20, fontWeight: '700', color: t.colors.cyan, marginTop: 2 },
    handHint: { fontSize: 11, color: t.colors.textMuted, marginTop: 4, lineHeight: 15 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    chipOn: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
    chipText: { fontSize: 11, fontWeight: '600', color: t.colors.textMuted },
    chipTextOn: { color: t.colors.bg },

    tableHead: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    th: {
      fontSize: 10,
      letterSpacing: t.type.tracking,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
      fontWeight: '600',
    },
    tr: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    // Colonnes à largeur fixe : un tableau RN n'a pas de `table-layout`, il faut
    // que l'en-tête et les lignes partagent exactement les mêmes contraintes.
    colName: { flex: 1, paddingRight: 8 },
    colLeft: { width: 46, textAlign: 'center' },
    colOdds: { width: 52, textAlign: 'right' },

    td: { fontSize: 12 },
    cardNameText: { fontSize: 13, color: t.colors.text, lineHeight: 17 },
    cardNameExhausted: { color: t.colors.textDim, textDecorationLine: 'line-through' },
    inHand: {
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.gold,
      letterSpacing: t.type.tracking,
      marginTop: 2,
    },
    empty: { fontSize: 13, color: t.colors.textMuted, paddingTop: 12 },
  });
