import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { collectionApi } from '@/services/collectionApi';
import { useDebounce } from '@/hooks/useDebounce';
import type { UserCard } from '@/types';
import AddCardModal from '@/components/AddCardModal';
import CardDetailModal from '@/components/CardDetailModal';

const PAGE_SIZE = 30;
const NUM_COLUMNS = 2;
const CARD_MARGIN = 8;

export default function CollectionScreen() {
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

  const [showAdd, setShowAdd] = useState(false);
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await collectionApi.list({
          page: targetPage,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
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
    [debouncedSearch]
  );

  useEffect(() => {
    fetchPage(1, true);
  }, [fetchPage]);

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
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMetaText} numberOfLines={1}>
            {item.rarity}
          </Text>
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyBadgeText}>x{item.quantity}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Ma Collection</Text>
          <Text style={styles.subtitle}>
            {total} carte{total > 1 ? 's' : ''} · {user?.username}
          </Text>
        </View>
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
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {loading && cards.length === 0 ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {debouncedSearch
              ? 'Aucune carte trouvée pour cette recherche.'
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
          contentContainerStyle={{ padding: CARD_MARGIN / 2 }}
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
                <ActivityIndicator color="#7c3aed" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  logoutText: { color: '#4b5563', fontSize: 12, fontWeight: '600' },
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
  scanBtn: { backgroundColor: '#7c3aed' },
  addBtn: { backgroundColor: '#2563eb' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  emptyLink: { fontSize: 14, color: '#7c3aed', fontWeight: '600' },
  cardBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardImage: { backgroundColor: '#e5e7eb' },
  cardMeta: { padding: 6 },
  cardName: { fontSize: 12, fontWeight: '600', color: '#111827' },
  cardMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMetaText: { flex: 1, fontSize: 10, color: '#6b7280' },
  qtyBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  qtyBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
