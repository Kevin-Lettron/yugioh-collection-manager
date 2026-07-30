import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { deckApi } from '@/services/deckApi';
import type { Deck } from '@/types';

export default function DecksScreen() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleDelete = (deck: Deck) => {
    Alert.alert(
      'Supprimer le deck ?',
      `"${deck.name}" sera définitivement supprimé.`,
      [
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
      ]
    );
  };

  const renderDeck = ({ item }: { item: Deck }) => {
    const mainCount = item.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
    const extraCount = item.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
    const mainOk = mainCount >= 40 && mainCount <= 60;
    const extraOk = extraCount <= 15;

    return (
      <TouchableOpacity
        style={styles.deckCard}
        onPress={() => router.push(`/deck/${item.id}`)}
        activeOpacity={0.7}>
        <View style={styles.deckHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deckName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.deckBadgeRow}>
              {item.is_public && (
                <View style={[styles.badge, styles.badgePublic]}>
                  <Text style={styles.badgeText}>Public</Text>
                </View>
              )}
              {item.is_shared && (
                <View style={[styles.badge, styles.badgeShared]}>
                  <Text style={styles.badgeText}>Partagé</Text>
                </View>
              )}
              {item.respect_banlist && (
                <View style={[styles.badge, styles.badgeBanlist]}>
                  <Text style={styles.badgeText}>Banlist</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.deckStats}>
          <StatBadge
            label="Main"
            value={mainCount}
            hint="40–60"
            ok={mainCount === 0 || mainOk}
          />
          <StatBadge label="Extra" value={extraCount} hint="≤15" ok={extraOk} />
          <View style={styles.spacer} />
          <Text style={styles.deckMeta}>❤️ {item.likes_count ?? 0}</Text>
          <Text style={styles.deckMeta}>💬 {item.comments_count ?? 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mes Decks</Text>
          <Text style={styles.subtitle}>
            {decks.length} deck{decks.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => router.push('/deck/new')}>
          <Text style={styles.newBtnText}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      {loading && decks.length === 0 ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : decks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucun deck créé.</Text>
          <TouchableOpacity onPress={() => router.push('/deck/new')}>
            <Text style={styles.emptyLink}>Créer ton premier deck</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderDeck}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchDecks(true)} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const StatBadge = ({
  label,
  value,
  hint,
  ok,
}: {
  label: string;
  value: number;
  hint: string;
  ok: boolean;
}) => (
  <View style={styles.statBadge}>
    <Text style={styles.statBadgeLabel}>{label}</Text>
    <Text style={[styles.statBadgeValue, !ok && styles.statBadgeValueBad]}>
      {value}
    </Text>
    <Text style={styles.statBadgeHint}>{hint}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  newBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: { fontSize: 15, color: '#6b7280' },
  emptyLink: { fontSize: 14, color: '#7c3aed', fontWeight: '600' },
  deckCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  deckHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  deckName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  deckBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgePublic: { backgroundColor: '#d1fae5' },
  badgeShared: { backgroundColor: '#fef3c7' },
  badgeBanlist: { backgroundColor: '#ede9fe' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#374151' },
  deleteIcon: { fontSize: 20 },
  deckStats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBadge: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  statBadgeLabel: { fontSize: 9, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  statBadgeValue: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  statBadgeValueBad: { color: '#dc2626' },
  statBadgeHint: { fontSize: 9, color: '#9ca3af' },
  spacer: { flex: 1 },
  deckMeta: { fontSize: 12, color: '#6b7280' },
});
