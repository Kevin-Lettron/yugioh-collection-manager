import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { collectionApi } from '@/services/collectionApi';
import { useDebounce } from '@/hooks/useDebounce';
import type { UserCard } from '@/types';

type Props = {
  visible: boolean;
  target: 'main' | 'extra';
  onClose: () => void;
  onPick: (card: UserCard) => void | Promise<void>;
};

const PAGE_SIZE = 40;
const NUM_COLUMNS = 3;
const MARGIN = 6;

const EXTRA_DECK_TYPES = new Set([
  'Fusion Monster',
  'Synchro Monster',
  'XYZ Monster',
  'Link Monster',
  'Synchro Tuner Monster',
  'XYZ Pendulum Effect Monster',
  'Pendulum Effect Fusion Monster',
]);

function isExtraDeckCard(t?: string): boolean {
  if (!t) return false;
  return Array.from(EXTRA_DECK_TYPES).some((et) => t.includes(et.split(' ')[0]));
}

export default function AddCardsFromCollectionModal({
  visible,
  target,
  onClose,
  onPick,
}: Props) {
  const [cards, setCards] = useState<UserCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [picking, setPicking] = useState<number | null>(null);

  const cardWidth = useMemo(() => {
    const screen = Dimensions.get('window').width;
    return (screen - MARGIN * (NUM_COLUMNS + 1) - 24) / NUM_COLUMNS;
  }, []);

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
        setTotalPages(res.total_pages);
        setPage(res.page);
        setCards((prev) => (replace ? res.data : [...prev, ...res.data]));
      } catch (err: any) {
        Alert.alert('Erreur', err?.response?.data?.error || 'Chargement échoué');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch]
  );

  useEffect(() => {
    if (visible) fetchPage(1, true);
  }, [visible, fetchPage]);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const isExtra = isExtraDeckCard(c.card?.type);
      return target === 'extra' ? isExtra : !isExtra;
    });
  }, [cards, target]);

  const handlePick = async (uc: UserCard) => {
    setPicking(uc.id);
    try {
      await onPick(uc);
    } finally {
      setPicking(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Ajouter à {target === 'main' ? 'Main Deck' : 'Extra Deck'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher dans la collection…"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.hint}>Tape une carte pour l'ajouter au deck.</Text>

        {loading && cards.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
          </View>
        ) : filteredCards.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              Aucune carte {target === 'extra' ? "d'extra deck" : 'main deck'} dans ta collection.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCards}
            keyExtractor={(item) => String(item.id)}
            numColumns={NUM_COLUMNS}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cardBox, { width: cardWidth }]}
                onPress={() => handlePick(item)}
                disabled={picking === item.id}>
                <Image
                  source={{ uri: item.card?.card_images?.[0]?.image_url_small }}
                  style={[styles.cardImage, { width: cardWidth, height: cardWidth * 1.46 }]}
                  resizeMode="cover"
                />
                {picking === item.id && (
                  <View style={styles.pickingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <View style={styles.cardOwnedBadge}>
                  <Text style={styles.cardOwnedText}>x{item.quantity}</Text>
                </View>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.card?.name}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ padding: MARGIN, paddingBottom: 40, gap: MARGIN }}
            columnWrapperStyle={{ gap: MARGIN }}
            onEndReached={() => {
              if (!loadingMore && page < totalPages) fetchPage(page + 1, false);
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={{ paddingVertical: 12 }}>
                  <ActivityIndicator color="#7c3aed" />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: '#6b7280' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  hint: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, color: '#6b7280' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  cardBox: {
    backgroundColor: '#fff',
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardImage: { backgroundColor: '#e5e7eb' },
  cardName: { fontSize: 10, fontWeight: '600', color: '#111827', padding: 4 },
  cardOwnedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  cardOwnedText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pickingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
