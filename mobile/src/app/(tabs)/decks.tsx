import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { deckApi } from '@/services/deckApi';
import type { Deck } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import { ScanFAB } from '@/components/decor/ScanFAB';
import { spacing } from '@/theme/palette';

const NUM_COLUMNS = 2;

/**
 * Écran « Mes decks » — même syntaxe visuelle que la Collection (sc-if isCollection
 * de PhoneFrame.dc.html) puisqu'aucun sc-if dédié Decks n'existe côté mobile.
 * Kicker « — Grimoires du Sanctuaire — » + titre gradient + stats bar biseautée
 * (2 cellules : Decks / Publics — Likes est en « — À venir » faute d'agrégat côté API)
 * + chips de filtre + grid 2 colonnes de deck-cards avec preview 3 mini-cartes en fan.
 */
export default function DecksScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeChip, setActiveChip] = useState<'all' | 'public' | 'shared'>('all');

  const fetchDecks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await deckApi.listMine();
      setDecks(data);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Chargement échoué');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDecks();
    }, [fetchDecks])
  );

  // Comptes agrégés côté client — les endpoints /decks/stats n'existent pas encore.
  const totals = useMemo(() => {
    const total = decks.length;
    const publics = decks.filter((d) => d.is_public).length;
    return { total, publics };
  }, [decks]);

  const filteredDecks = useMemo(() => {
    if (activeChip === 'public') return decks.filter((d) => d.is_public);
    if (activeChip === 'shared') return decks.filter((d) => d.is_shared);
    return decks;
  }, [decks, activeChip]);

  const chips: Array<{ key: 'all' | 'public' | 'shared'; label: string; count: number | null }> = [
    { key: 'all', label: 'Tous', count: totals.total },
    { key: 'public', label: 'Publics', count: totals.publics },
    { key: 'shared', label: 'Partagés', count: null },
  ];

  const handleDelete = (deck: Deck) => {
    Alert.alert('Sceller ce grimoire au néant ?', `« ${deck.name} » sera perdu.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deckApi.remove(deck.id);
            setDecks((prev) => prev.filter((d) => d.id !== deck.id));
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.error || 'Suppression échouée');
          }
        },
      },
    ]);
  };

  /** Deck card — tuile inspirée des preview decks du profil (PhoneFrame ligne 449-457). */
  const renderDeck = ({ item }: { item: Deck }) => {
    const mainCount = item.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
    const extraCount = item.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
    const sideCount = 0; // pas encore de side_deck côté modèle

    return (
      <TouchableOpacity
        style={styles.deckCard}
        onPress={() => router.push(`/deck/${item.id}`)}
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.75}>
        {/* Fan 3 mini-cartes (comme les vignettes preview du social) */}
        <View style={styles.fanRow}>
          <View style={[styles.fanCard, styles.fanCardA, { borderColor: colors.rarityUltra }]} />
          <View style={[styles.fanCard, styles.fanCardB, { borderColor: colors.raritySuper }]} />
          <View style={[styles.fanCard, styles.fanCardC, { borderColor: colors.raritySecret2 }]} />
        </View>

        <Text style={styles.deckName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.deckMetaRow}>
          <Text style={styles.deckCount}>
            {mainCount} · {extraCount} · {sideCount}
          </Text>
          <Text style={styles.deckLikes}>♥ {item.likes_count ?? 0}</Text>
        </View>

        {(item.is_public || item.is_shared || item.respect_banlist) && (
          <View style={styles.deckBadgeRow}>
            {item.is_public && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Public</Text>
              </View>
            )}
            {item.is_shared && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Partagé</Text>
              </View>
            )}
            {item.respect_banlist && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Banlist</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.contentPadding}>
      {/* Bloc titre — kicker + titre + sub + stats bar biseautée (2 cellules) */}
      <View style={styles.headerBlock}>
        <Text style={styles.kicker}>— Grimoires du Sanctuaire —</Text>
        <Text style={styles.title}>Mes Decks</Text>
        <Text style={styles.sub}>
          {totals.total} grimoire{totals.total > 1 ? 's' : ''} dressé{totals.total > 1 ? 's' : ''}.
        </Text>

        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <View style={styles.statAccent} />
            <Text style={styles.statLabel}>Publics</Text>
            <Text style={styles.statValueGold}>{totals.publics}</Text>
          </View>
          <View style={styles.statCell}>
            <View style={styles.statAccent} />
            <Text style={styles.statLabel}>Likes reçus</Text>
            <Text style={styles.statValue}>— À venir</Text>
          </View>
        </View>
      </View>

      {/* Chips filtre scrollable — même syntaxe que Collection */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
        {chips.map((chip) => {
          const active = activeChip === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => setActiveChip(chip.key)}
              style={[
                styles.chip,
                active && { backgroundColor: colors.gold, borderColor: colors.gold },
              ]}>
              <Text style={[styles.chipLabel, active && { color: colors.onGold }]}>
                {chip.label}
              </Text>
              <View style={[styles.chipBadge, active && { backgroundColor: 'rgba(11,9,6,0.2)' }]}>
                <Text style={[styles.chipBadgeText, active && { color: colors.onGold }]}>
                  {chip.count === null ? '—' : chip.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ height: 16 }} />
    </View>
  );

  /** Slot vide « + Dresser un deck » — copie fidèle du bloc PhoneFrame l.459-462. */
  const renderEmptySlot = () => (
    <TouchableOpacity style={styles.emptySlot} onPress={() => router.push('/deck/new')}>
      <View style={styles.emptySlotGlyph}>
        <View style={styles.emptySlotDiamond} />
      </View>
      <Text style={styles.emptySlotText}>Dresser{'\n'}un deck</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />

        {loading && decks.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={filteredDecks}
            keyExtractor={(item) => String(item.id)}
            numColumns={NUM_COLUMNS}
            renderItem={renderDeck}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            columnWrapperStyle={{ gap: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchDecks(true)}
                tintColor={colors.gold}
              />
            }
            ListFooterComponent={
              filteredDecks.length > 0 ? (
                <View style={{ marginTop: 10 }}>{renderEmptySlot()}</View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Aucun grimoire ne correspond.</Text>
                  <TouchableOpacity onPress={() => router.push('/deck/new')}>
                    <Text style={styles.emptyLink}>Fonder ton premier deck</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
      <ScanFAB />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    contentPadding: { paddingTop: 18 },

    // ─── Header block ─────────────────────────────────
    headerBlock: {
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 3,
      color: t.colors.gold,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      fontFamily: 'sans-serif',
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: 1,
      lineHeight: 32,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    sub: {
      marginTop: 6,
      fontSize: 13,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
    },

    // ─── Stats bar biseautée ──────────────────────────
    statsBar: {
      marginTop: 16,
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.border,
      gap: 1,
    },
    statCell: {
      flex: 1,
      padding: 12,
      backgroundColor: t.colors.panel,
      position: 'relative',
      overflow: 'hidden',
      gap: 4,
    },
    statAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 3,
      height: '100%',
      backgroundColor: t.colors.gold,
      opacity: 0.6,
    },
    statLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      color: t.colors.textMuted,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    statValue: {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.text,
      lineHeight: 20,
    },
    statValueGold: {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.gold,
      lineHeight: 20,
    },

    // ─── Chips ────────────────────────────────────────
    chipsScroll: { marginTop: 14 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    chipLabel: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '600',
      color: t.colors.text,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    chipBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      backgroundColor: 'rgba(245,197,24,0.15)',
    },
    chipBadgeText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.gold,
    },

    // ─── Deck cards ───────────────────────────────────
    deckCard: {
      flex: 1,
      padding: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 4,
    },
    fanRow: {
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    fanCard: {
      width: 30,
      height: 44,
      borderWidth: 1,
      backgroundColor: t.colors.panel2,
    },
    fanCardA: { transform: [{ rotate: '-6deg' }] },
    fanCardB: { marginLeft: -10, transform: [{ rotate: '4deg' }], zIndex: 2 },
    fanCardC: { marginLeft: -10, transform: [{ rotate: '12deg' }] },

    deckName: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    deckMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 3,
    },
    deckCount: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.textMuted,
      fontWeight: '600',
    },
    deckLikes: {
      fontSize: 10,
      color: t.colors.magenta,
      fontWeight: '600',
    },
    deckBadgeRow: {
      marginTop: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel2,
    },
    badgeText: {
      fontSize: 8,
      fontWeight: '700',
      color: t.colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // ─── Empty slot ───────────────────────────────────
    emptySlot: {
      padding: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 120,
    },
    emptySlotGlyph: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptySlotDiamond: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: t.colors.goldDim,
      transform: [{ rotate: '45deg' }],
      opacity: 0.6,
    },
    emptySlotText: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      textAlign: 'center',
    },

    // ─── Empty state (aucun deck du tout) ─────────────
    emptyState: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: { fontSize: 15, color: t.colors.textMuted, textAlign: 'center' },
    emptyLink: { fontSize: 14, color: t.colors.gold, fontWeight: '600' },
  });
