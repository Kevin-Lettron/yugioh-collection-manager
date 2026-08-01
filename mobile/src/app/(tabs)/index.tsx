import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { collectionApi } from '@/services/collectionApi';
import { useDebounce } from '@/hooks/useDebounce';
import type { UserCard } from '@/types';
import AddCardModal from '@/components/AddCardModal';
import CardDetailModal from '@/components/CardDetailModal';
import FiltersModal, { type CollectionFilterValues } from '@/components/FiltersModal';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, useTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { CardTile } from '@/components/decor/CardTile';
import { spacing } from '@/theme/palette';

const PAGE_SIZE = 30;
const NUM_COLUMNS = 2;
const EMPTY_FILTERS: CollectionFilterValues = { type: '', attribute: '', rarity: '' };

export default function CollectionScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

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

  const activeFilterCount =
    (filters.type ? 1 : 0) + (filters.attribute ? 1 : 0) + (filters.rarity ? 1 : 0);

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

  // Rechargement à chaque fois que l'écran reprend le focus : sans ça, une carte
  // ajoutée depuis le scanner n'apparaît qu'après un redémarrage de l'app.
  // (Se déclenche aussi au montage, et à chaque changement de recherche/filtres.)
  useFocusEffect(
    useCallback(() => {
      fetchPage(1, true);
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
  }, [fetchPage]);

  const renderCard = ({ item }: { item: UserCard }) => (
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

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <HeroTitle
              kicker="— Vitrine du Millénium —"
              title="Ma Collection"
              sub={`${total} carte${total > 1 ? 's' : ''} rassemblée${total > 1 ? 's' : ''} · ${user?.username ?? ''}`}
            />
          </View>
          <TouchableOpacity
            onPress={toggleTheme}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={
              theme.name === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
            }>
            <Text style={styles.iconBtnText}>{theme.name === 'dark' ? '☀' : '☾'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>Déco</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <CyberButton
            label="Scanner"
            variant="primary"
            onPress={() => router.push('/scan')}
            block
            style={{ flex: 1 }}
          />
          <CyberButton
            label="+ Ajouter"
            variant="secondary"
            onPress={() => setShowAdd(true)}
            block
            style={{ flex: 1 }}
          />
        </View>

        <View style={styles.searchWrap}>
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
          <TouchableOpacity
            style={[styles.filtersBtn, activeFilterCount > 0 && styles.filtersBtnActive]}
            onPress={() => setShowFilters(true)}>
            <Text style={[styles.filtersBtnText, activeFilterCount > 0 && styles.filtersBtnTextActive]}>
              Filtres {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {activeFilterCount > 0 && (
          <View style={styles.activeFiltersRow}>
            {filters.type ? (
              <ActiveFilterChip
                label={filters.type}
                onClear={() => setFilters((f) => ({ ...f, type: '' }))}
              />
            ) : null}
            {filters.attribute ? (
              <ActiveFilterChip
                label={filters.attribute}
                onClear={() => setFilters((f) => ({ ...f, attribute: '' }))}
              />
            ) : null}
            {filters.rarity ? (
              <ActiveFilterChip
                label={filters.rarity}
                onClear={() => setFilters((f) => ({ ...f, rarity: '' }))}
              />
            ) : null}
            <TouchableOpacity onPress={() => setFilters(EMPTY_FILTERS)}>
              <Text style={styles.resetLink}>Reset</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && cards.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : cards.length === 0 ? (
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
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item) => String(item.id)}
            numColumns={NUM_COLUMNS}
            renderItem={renderCard}
            contentContainerStyle={{ paddingHorizontal: spacing[3], paddingBottom: spacing[7] }}
            columnWrapperStyle={{ gap: spacing[3] }}
            ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: spacing[5] }}>
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null
            }
          />
        )}

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
              setShowFilters(false);
            }}
          />
        )}
      </SafeAreaView>
      <CornerOrnaments />
    </View>
  );
}

const ActiveFilterChip = ({ label, onClear }: { label: string; onClear: () => void }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.activeChip}>
    <Text style={styles.activeChipText} numberOfLines={1}>
      {label}
    </Text>
    <TouchableOpacity onPress={onClear} style={styles.activeChipClose}>
      <Text style={styles.activeChipCloseText}>✕</Text>
    </TouchableOpacity>
  </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  iconBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    backgroundColor: t.colors.panel2,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  iconBtnText: { color: t.colors.textMuted, fontSize: 12, fontWeight: '600' },
  actions: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchWrap: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    backgroundColor: t.colors.panel,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 15,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: t.colors.gold,
    color: t.colors.text,
  },
  filtersBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    justifyContent: 'center',
  },
  filtersBtnActive: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
  filtersBtnText: { color: t.colors.text, fontSize: 13, fontWeight: '600' },
  filtersBtnTextActive: { color: t.colors.onGold },
  activeFiltersRow: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.panel2,
    paddingLeft: spacing[3],
    paddingRight: spacing[1],
    paddingVertical: spacing[1],
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[1],
    maxWidth: 200,
  },
  activeChipText: { color: t.colors.gold, fontSize: 11, fontWeight: '600' },
  activeChipClose: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.bg,
    borderWidth: 1,
    borderColor: t.colors.gold,
  },
  activeChipCloseText: { color: t.colors.gold, fontSize: 10, fontWeight: '700' },
  resetLink: { color: t.colors.danger, fontSize: 12, fontWeight: '600', marginLeft: spacing[1] },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[7],
    gap: spacing[3],
  },
  emptyText: { fontSize: 15, color: t.colors.textMuted, textAlign: 'center' },
  emptyLink: { fontSize: 14, color: t.colors.gold, fontWeight: '600' },
  cardCell: { flex: 1 },
});
