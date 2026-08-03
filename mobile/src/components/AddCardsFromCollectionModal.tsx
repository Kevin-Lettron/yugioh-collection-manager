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
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  target: 'main' | 'extra';
  onClose: () => void;
  onPick: (card: UserCard) => void | Promise<void>;
};

const PAGE_SIZE = 40;
const NUM_COLUMNS = 3;
const MARGIN = 6;

/**
 * Miroir de shared/cards.ts — le mobile ne peut pas importer hors de son
 * package (cf. le commentaire en tête de src/types.ts). Toute modification ici
 * doit être répercutée là-bas.
 *
 * L'ancienne version testait les premiers mots de la liste, dont « Pendulum » :
 * une « Pendulum Effect Monster », qui est une carte de **Main Deck**, se
 * retrouvait donc classée en Extra.
 */
const EXTRA_DECK_FRAMES = ['fusion', 'synchro', 'xyz', 'link'];

function isExtraDeckCard(card?: { type?: string | null; frame_type?: string | null } | null): boolean {
  if (!card) return false;

  // `frame_type` est normalisé à quatre valeurs, contrairement à `type` qui se
  // décline (« Synchro Tuner Monster », « Pendulum Effect Fusion Monster »…).
  const frame = (card.frame_type ?? '').toLowerCase().trim();
  if (frame) return EXTRA_DECK_FRAMES.includes(frame);

  const type = (card.type ?? '').toLowerCase();
  return type ? EXTRA_DECK_FRAMES.some((keyword) => type.includes(keyword)) : false;
}

export default function AddCardsFromCollectionModal({
  visible,
  target,
  onClose,
  onPick,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
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
      const isExtra = isExtraDeckCard(c.card);
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
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.hint}>Tape une carte pour l'ajouter au deck.</Text>

        {loading && cards.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
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
                    <ActivityIndicator color={colors.onGold} />
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
                  <ActivityIndicator color={colors.gold} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: t.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: t.colors.text },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: t.colors.textMuted },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  searchInput: {
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    color: t.colors.text,
  },
  hint: { paddingHorizontal: 16, paddingVertical: 6, fontSize: 12, color: t.colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center' },
  cardBox: {
    backgroundColor: t.colors.panel,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardImage: { backgroundColor: t.colors.panel2 },
  cardName: { fontSize: 10, fontWeight: '600', color: t.colors.text, padding: 4 },
  cardOwnedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  cardOwnedText: { color: t.colors.onGold, fontSize: 10, fontWeight: '700' },
  pickingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
