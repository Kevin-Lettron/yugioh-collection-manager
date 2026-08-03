import { Modal, View, Text, Image, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import type { DeckCard } from '@/types';

export type ZoneKey = 'extra' | 'graveyard' | 'banished';

export const ZONE_LABELS: Record<ZoneKey, string> = {
  extra: 'Extra Deck',
  graveyard: 'Cimetière',
  banished: 'Bannis',
};

interface ZoneSheetProps {
  zone: ZoneKey | null;
  cards: DeckCard[];
  onClose: () => void;
}

/**
 * Contenu d'une zone du plateau, en feuille modale.
 *
 * L'Extra Deck est regroupé par carte avec sa quantité. Le Cimetière et les
 * Bannis gardent leur ordre d'arrivée : au jeu, l'ordre du cimetière compte.
 */
export default function ZoneSheet({ zone, cards, onClose }: ZoneSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();

  if (!zone) return null;

  const accent =
    zone === 'extra' ? colors.cyan : zone === 'graveyard' ? colors.magenta : colors.violet;

  const entries =
    zone === 'extra'
      ? Object.values(
          cards.reduce<Record<number, { card: DeckCard; count: number }>>((acc, dc) => {
            const cur = acc[dc.card_id];
            if (cur) cur.count += dc.quantity;
            else acc[dc.card_id] = { card: dc, count: dc.quantity };
            return acc;
          }, {})
        )
      : cards.map((dc) => ({ card: dc, count: 1 }));

  const total = entries.reduce((s, e) => s + e.count, 0);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={[styles.sheet, { borderColor: accent }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: accent }]}>{ZONE_LABELS[zone]}</Text>
            <Text style={styles.count}>
              {total} carte{total > 1 ? 's' : ''}
            </Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Fermer">
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {total === 0 ? (
            <Text style={styles.empty}>
              {zone === 'extra'
                ? "Ce deck n'a pas d'Extra Deck."
                : `${ZONE_LABELS[zone]} vide pour l'instant.`}
            </Text>
          ) : (
            <ScrollView contentContainerStyle={styles.grid}>
              {entries.map((entry, i) => {
                const uri =
                  entry.card.card?.card_images?.[0]?.image_url_small ||
                  entry.card.card?.card_images?.[0]?.image_url;
                const name = entry.card.card?.name_fr || entry.card.card?.name || '—';
                return (
                  <View key={`${entry.card.card_id}-${i}`} style={styles.cell}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.art} resizeMode="cover" />
                    ) : (
                      <View style={[styles.art, styles.artFallback]}>
                        <Text style={styles.artFallbackText} numberOfLines={3}>
                          {name}
                        </Text>
                      </View>
                    )}
                    {entry.count > 1 && (
                      <View style={[styles.qty, { borderColor: accent }]}>
                        <Text style={[styles.qtyText, { color: accent }]}>×{entry.count}</Text>
                      </View>
                    )}
                    <Text style={styles.name} numberOfLines={2}>
                      {name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '80%',
      backgroundColor: t.colors.panel,
      borderTopWidth: 2,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 24,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    title: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: t.type.trackingWide,
    },
    count: { fontSize: 12, color: t.colors.textMuted },
    close: { fontSize: 20, color: t.colors.textMuted, paddingHorizontal: 4 },
    empty: { fontSize: 13, color: t.colors.textMuted, paddingVertical: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 10 },
    cell: { width: 88 },
    art: {
      width: 88,
      height: 128,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElev,
    },
    artFallback: { alignItems: 'center', justifyContent: 'center', padding: 6 },
    artFallbackText: { fontSize: 9, color: t.colors.textDim, textAlign: 'center' },
    qty: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: t.colors.bg,
      borderWidth: 1,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    qtyText: { fontSize: 10, fontWeight: '700' },
    name: { fontSize: 10, color: t.colors.textMuted, marginTop: 4, lineHeight: 13 },
  });
