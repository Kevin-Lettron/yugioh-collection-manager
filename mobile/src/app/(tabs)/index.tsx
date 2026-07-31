import { useCallback, useMemo, useState } from 'react';
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
  Dimensions,
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
import { MillenniumMark } from '@/components/CyberSurfaces';

const PAGE_SIZE = 30;
const NUM_COLUMNS = 2;
const CARD_MARGIN = 8;
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

  const updateQty = useCallback(async (card: UserCard, delta: number) => {
    const next = card.quantity + delta;
    if (next < 1) {
      Alert.alert('Retirer ?', `${card.card?.name || 'Carte'} sera retirée.`, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionApi.remove(card.id);
              setCards((prev) => prev.filter((c) => c.id !== card.id));
              setTotal((t) => Math.max(0, t - 1));
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error || 'Suppression échouée');
            }
          },
        },
      ]);
      return;
    }
    // Optimistic update
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, quantity: next } : c)));
    try {
      await collectionApi.setQuantity(card.id, next);
    } catch (err: any) {
      // Rollback
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, quantity: card.quantity } : c)));
      Alert.alert('Erreur', err?.response?.data?.error || 'Mise à jour échouée');
    }
  }, []);

  const cardWidth = useMemo(() => {
    const screen = Dimensions.get('window').width;
    const totalMargin = CARD_MARGIN * (NUM_COLUMNS + 1);
    return (screen - totalMargin) / NUM_COLUMNS;
  }, []);

  const renderCard = ({ item }: { item: UserCard }) => (
    <TouchableOpacity
      style={[styles.cardBox, { width: cardWidth }]}
      activeOpacity={0.8}
      onPress={() => setSelectedCard(item)}>
      <Image
        source={{
          uri:
            item.card?.card_images?.[0]?.image_url_small ||
            item.card?.card_images?.[0]?.image_url,
        }}
        style={[styles.cardImage, { width: cardWidth, height: cardWidth * 1.46 }]}
        resizeMode="cover"
      />
      <View style={styles.cardMeta}>
        <Text style={styles.cardName} numberOfLines={1}>
          {item.card?.name || `Carte #${item.card_id}`}
        </Text>
        <Text style={styles.cardMetaText} numberOfLines={1}>
          {item.rarity} · {item.language}
        </Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={(e) => {
              e.stopPropagation();
              updateQty(item, -1);
            }}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={(e) => {
              e.stopPropagation();
              updateQty(item, 1);
            }}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MillenniumMark size={30} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ma Collection</Text>
          <Text style={styles.subtitle}>
            {total} carte{total > 1 ? 's' : ''} · {user?.username}
          </Text>
        </View>
        <TouchableOpacity
          onPress={toggleTheme}
          style={styles.logoutBtn}
          accessibilityRole="button"
          accessibilityLabel={
            theme.name === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
          }>
          <Text style={styles.logoutText}>{theme.name === 'dark' ? '☀' : '☾'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Déco</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.scanBtn]}
          onPress={() => router.push('/scan')}>
          <Text style={styles.actionBtnText}>📷 Scanner</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.addBtn]}
          onPress={() => setShowAdd(true)}>
          <Text style={styles.actionBtnText}>+ Ajouter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une carte…"
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
              : 'Aucune carte dans ta collection.'}
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
          contentContainerStyle={{ padding: CARD_MARGIN / 2, paddingBottom: 40 }}
          columnWrapperStyle={{ gap: CARD_MARGIN }}
          ItemSeparatorComponent={() => <View style={{ height: CARD_MARGIN }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20 }}>
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
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: t.colors.text },
  subtitle: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: t.colors.panel2,
  },
  logoutText: { color: t.colors.textMuted, fontSize: 12, fontWeight: '600' },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanBtn: { backgroundColor: t.colors.gold },
  addBtn: { backgroundColor: t.colors.cyan },
  actionBtnText: { color: t.colors.onGold, fontSize: 14, fontWeight: '600' },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: t.colors.border,
    color: t.colors.text,
  },
  filtersBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    justifyContent: 'center',
  },
  filtersBtnActive: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
  filtersBtnText: { color: t.colors.text, fontSize: 13, fontWeight: '600' },
  filtersBtnTextActive: { color: t.colors.onGold },
  activeFiltersRow: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.panel2,
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    maxWidth: 200,
  },
  activeChipText: { color: t.colors.gold, fontSize: 11, fontWeight: '600' },
  activeChipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.gold,
  },
  activeChipCloseText: { color: t.colors.gold, fontSize: 10, fontWeight: '700' },
  resetLink: { color: t.colors.danger, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: { fontSize: 15, color: t.colors.textMuted, textAlign: 'center' },
  emptyLink: { fontSize: 14, color: t.colors.gold, fontWeight: '600' },
  cardBox: {
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: t.colors.camera,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardImage: { backgroundColor: t.colors.panel2 },
  cardMeta: { padding: 6, gap: 4 },
  cardName: { fontSize: 12, fontWeight: '600', color: t.colors.text },
  cardMetaText: { fontSize: 10, color: t.colors.textMuted },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: t.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  qtyBtnText: { fontSize: 16, color: t.colors.text, fontWeight: '700' },
  qtyValue: { fontSize: 13, fontWeight: '700', color: t.colors.text },
});
