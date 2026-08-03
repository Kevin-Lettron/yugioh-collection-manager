import { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
// useAuth n'est plus utilisé ici — l'avatar nav vers /profile où le logout se fait.
import { collectionApi } from '@/services/collectionApi';
import { useDebounce } from '@/hooks/useDebounce';
import type { CollectionStats, UserCard } from '@/types';
import AddCardModal from '@/components/AddCardModal';
import CardDetailModal from '@/components/CardDetailModal';
import FiltersModal, { type CollectionFilterValues } from '@/components/FiltersModal';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import { ScanFAB } from '@/components/decor/ScanFAB';
import { CardTile } from '@/components/decor/CardTile';
import { spacing } from '@/theme/palette';

const PAGE_SIZE = 30;
const NUM_COLUMNS = 2;
const EMPTY_FILTERS: CollectionFilterValues = { type: '', attribute: '', rarity: '' };

/** Cellule fantôme qui complète la dernière ligne de la grille (voir paddedCards). */
const SPACER = { id: -1 } as UserCard;

const SEARCH_ICON = require('@/assets/images/ui/i-search.png');
const FILTER_ICON = require('@/assets/images/ui/i-filter.png');

type QuickFilter = {
  key: string;
  label: string;
  count: number | null; // null = "À venir" (pas d'endpoint stats encore)
  filter: Partial<CollectionFilterValues>;
};

export default function CollectionScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();

  const [cards, setCards] = useState<UserCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const [filters, setFilters] = useState<CollectionFilterValues>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [activeChip, setActiveChip] = useState<string>('all');
  const [stats, setStats] = useState<CollectionStats | null>(null);

  const activeFilterCount =
    (filters.type ? 1 : 0) + (filters.attribute ? 1 : 0) + (filters.rarity ? 1 : 0);

  // Chips en tête de grille. Les counts par type ne sont pas encore agrégés côté
  // backend (à faire dans dev-features → endpoint /collection/stats). En attendant,
  // seul le total « Toutes » est affiché avec un vrai chiffre.
  const chips: QuickFilter[] = useMemo(
    () => [
      { key: 'all', label: 'Toutes', count: total, filter: {} },
      { key: 'monsters', label: 'Monstres', count: stats?.by_type.monster ?? null, filter: { type: 'Effect Monster' } },
      { key: 'spells', label: 'Magies', count: stats?.by_type.spell ?? null, filter: { type: 'Spell Card' } },
      { key: 'traps', label: 'Pièges', count: stats?.by_type.trap ?? null, filter: { type: 'Trap Card' } },
      { key: 'extra', label: 'Extra Deck', count: stats?.by_type.extra ?? null, filter: { type: 'Fusion Monster' } },
    ],
    [total, stats]
  );

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await collectionApi.list({
          page: targetPage,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          type: filters.type || undefined,
          attribute: filters.attribute || undefined,
          rarity: filters.rarity || undefined,
        });
        setTotal(res.total);
        setTotalPages(res.total_pages);
        setPage(res.page);
        setCards((prev) => (replace ? res.data : [...prev, ...res.data]));
      } catch (err: any) {
        Alert.alert('Erreur', err?.response?.data?.error || 'Chargement échoué');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [debouncedSearch, filters]
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage(1, true);
      collectionApi.stats().then(setStats).catch(() => {});
    }, [fetchPage])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPage(1, true);
  }, [fetchPage]);

  const handleEndReached = useCallback(() => {
    if (loading || loadingMore) return;
    if (page >= totalPages) return;
    fetchPage(page + 1, false);
  }, [loading, loadingMore, page, totalPages, fetchPage]);

  const handleAdded = useCallback(() => {
    setShowAdd(false);
    fetchPage(1, true);
    collectionApi.stats().then(setStats).catch(() => {});
  }, [fetchPage]);

  const applyChip = (chip: QuickFilter) => {
    setActiveChip(chip.key);
    setFilters({
      type: chip.filter.type || '',
      attribute: chip.filter.attribute || '',
      rarity: chip.filter.rarity || '',
    });
  };

  // Avatar géré par défaut par AppHeader → nav vers /(tabs)/profile.
  // (avant : ouvrait une alerte déconnexion, à faire depuis la page profil).

  // Une carte seule sur la dernière ligne s'étirait sur toute la largeur : avec
  // `flex: 1`, elle occupe l'espace laissé libre par la case manquante. On
  // complète donc la liste par une cellule vide, qui absorbe cet espace et
  // laisse la carte exactement à la taille des autres.
  const paddedCards = useMemo(
    () => (cards.length % NUM_COLUMNS === 0 ? cards : [...cards, SPACER]),
    [cards]
  );

  const renderCard = ({ item }: { item: UserCard }) => {
    if (item === SPACER) return <View style={styles.cardCell} />;

    return (
    <View style={styles.cardCell}>
      <CardTile
        uri={
          item.card?.card_images?.[0]?.image_url_small ||
          item.card?.card_images?.[0]?.image_url
        }
        name={item.card?.name || `Carte #${item.card_id}`}
        rarity={item.rarity}
        quantity={item.quantity}
        language={item.language}
        onPress={() => setSelectedCard(item)}
      />
    </View>
    );
  };

  const listHeader = (
    <View style={styles.contentPadding}>
      {/* Bloc titre avec border-bottom */}
      <View style={styles.headerBlock}>
        <Text style={styles.kicker}>— Vitrine du Millénium —</Text>
        <Text style={styles.title}>Ma Collection</Text>
        <Text style={styles.sub}>
          {total.toLocaleString('fr-FR')} carte{total > 1 ? 's' : ''} rassemblée{total > 1 ? 's' : ''}.
        </Text>

        {/* Stats bar biseautée 2 col */}
        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <View style={styles.statAccent} />
            <Text style={styles.statLabel}>Ultra rares +</Text>
            <Text style={styles.statValueGold}>
              {stats ? stats.ultra_rares_count.toLocaleString('fr-FR') : '—'}
            </Text>
          </View>
          <View style={styles.statCell}>
            <View style={styles.statAccent} />
            <Text style={styles.statLabel}>Valeur estimée</Text>
            <Text style={styles.statValue}>
              {stats
                ? stats.total_value_eur.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                    maximumFractionDigits: 0,
                  })
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Search + filter row */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Image
            source={SEARCH_ICON}
            style={{ width: 16, height: 16, tintColor: colors.gold, position: 'absolute', left: 12, top: 13 }}
            resizeMode="contain"
          />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Cherche une carte…"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterBtn,
            activeFilterCount > 0 && { borderColor: colors.gold },
          ]}
          onPress={() => setShowFilters(true)}
          accessibilityLabel="Ouvrir les filtres">
          <Image
            source={FILTER_ICON}
            style={{ width: 18, height: 18, tintColor: colors.gold }}
            resizeMode="contain"
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Chips filter scrollable */}
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
              onPress={() => applyChip(chip)}
              style={[
                styles.chip,
                active && { backgroundColor: colors.gold, borderColor: colors.gold },
              ]}>
              <Text style={[styles.chipLabel, active && { color: colors.onGold }]}>
                {chip.label}
              </Text>
              <View style={[styles.chipBadge, active && { backgroundColor: 'rgba(11,9,6,0.2)' }]}>
                <Text style={[styles.chipBadgeText, active && { color: colors.onGold }]}>
                  {chip.count === null ? '—' : chip.count.toLocaleString('fr-FR')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ height: 16 }} />
    </View>
  );

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />

        {loading && cards.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={paddedCards}
            keyExtractor={(item) => (item === SPACER ? 'spacer' : String(item.id))}
            numColumns={NUM_COLUMNS}
            renderItem={renderCard}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            columnWrapperStyle={{ gap: 12 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {debouncedSearch || activeFilterCount > 0
                      ? 'Aucune carte ne correspond aux critères.'
                      : 'Ta vitrine attend sa première pièce.'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowAdd(true)}>
                    <Text style={styles.emptyLink}>Ajouter ta première carte</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: spacing[5] }}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>

      {/* FAB scan flottant, au-dessus du tab bar */}
      <ScanFAB />

      {showAdd && (
        <AddCardModal
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}

      {selectedCard && (
        <CardDetailModal
          visible={!!selectedCard}
          userCard={selectedCard}
          onClose={() => setSelectedCard(null)}
          onDeleted={() => {
            setSelectedCard(null);
            fetchPage(1, true);
          }}
        />
      )}

      {showFilters && (
        <FiltersModal
          visible={showFilters}
          initial={filters}
          onClose={() => setShowFilters(false)}
          onApply={(v) => {
            setFilters(v);
            setActiveChip(''); // les chips ne matchent plus si filtre manuel
            setShowFilters(false);
          }}
        />
      )}
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

    // ─── Search row ───────────────────────────────────
    searchRow: {
      marginTop: 18,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'stretch',
    },
    searchInputWrap: {
      flex: 1,
      position: 'relative',
    },
    searchInput: {
      backgroundColor: t.colors.panel,
      paddingHorizontal: 14,
      paddingLeft: 38,
      paddingVertical: 11,
      fontSize: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.gold,
      color: t.colors.text,
    },
    filterBtn: {
      width: 44,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    filterCount: {
      position: 'absolute',
      top: 3,
      right: 3,
      minWidth: 14,
      height: 14,
      paddingHorizontal: 3,
      backgroundColor: t.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterCountText: {
      color: t.colors.onGold,
      fontSize: 9,
      fontWeight: '700',
    },

    // ─── Chips ────────────────────────────────────────
    chipsScroll: {
      marginTop: 14,
    },
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

    // ─── Grid + empty ─────────────────────────────────
    cardCell: { flex: 1 },
    emptyState: {
      padding: 60,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: { fontSize: 15, color: t.colors.textMuted, textAlign: 'center' },
    emptyLink: { fontSize: 14, color: t.colors.gold, fontWeight: '600' },
  });
