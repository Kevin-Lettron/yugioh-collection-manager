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
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { spacing } from '@/theme/palette';

export default function DecksScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
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
        {/* Liseré or gauche */}
        <View style={styles.deckAccent} pointerEvents="none" />
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
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteBtn}>
            <Text style={styles.deleteIcon}>×</Text>
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
          <Text style={styles.deckMeta}>♥ {item.likes_count ?? 0}</Text>
          <Text style={styles.deckMeta}>◦ {item.comments_count ?? 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <HeroTitle
              kicker="— Grimoires du Sanctuaire —"
              title="Mes Decks"
              sub={`${decks.length} deck${decks.length > 1 ? 's' : ''} dressé${decks.length > 1 ? 's' : ''}`}
            />
          </View>
          <CyberButton
            label="+ Nouveau"
            size="sm"
            onPress={() => router.push('/deck/new')}
          />
        </View>

        {loading && decks.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : decks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Commence ton grimoire.</Text>
            <TouchableOpacity onPress={() => router.push('/deck/new')}>
              <Text style={styles.emptyLink}>Fonder ton premier deck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={decks}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDeck}
            contentContainerStyle={{
              padding: spacing[3],
              gap: spacing[3],
              paddingBottom: spacing[7],
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchDecks(true)}
                tintColor={colors.gold}
              />
            }
          />
        )}
      </SafeAreaView>
      <CornerOrnaments />
    </View>
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
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.statBadge}>
    <Text style={styles.statBadgeLabel}>{label}</Text>
    <Text style={[styles.statBadgeValue, !ok && styles.statBadgeValueBad]}>
      {value}
    </Text>
    <Text style={styles.statBadgeHint}>{hint}</Text>
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
    paddingBottom: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[7],
    gap: spacing[3],
  },
  emptyText: { fontSize: 15, color: t.colors.textMuted },
  emptyLink: { fontSize: 14, color: t.colors.gold, fontWeight: '600' },
  deckCard: {
    backgroundColor: t.colors.panel,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[3],
    position: 'relative',
    overflow: 'hidden',
  },
  deckAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: t.colors.gold,
    opacity: 0.7,
  },
  deckHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  deckName: {
    fontSize: 16,
    fontWeight: '700',
    color: t.colors.text,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  deckBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1], marginTop: spacing[1] },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  badgePublic: { backgroundColor: t.colors.panel2 },
  badgeShared: { backgroundColor: t.colors.panel2 },
  badgeBanlist: { backgroundColor: t.colors.panel2 },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  deleteIcon: { fontSize: 16, color: t.colors.textMuted, lineHeight: 18 },
  deckStats: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statBadge: {
    backgroundColor: t.colors.bg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statBadgeLabel: {
    fontSize: 9,
    color: t.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statBadgeValue: { fontSize: 16, fontWeight: '700', color: t.colors.success },
  statBadgeValueBad: { color: t.colors.danger },
  statBadgeHint: { fontSize: 9, color: t.colors.textMuted },
  spacer: { flex: 1 },
  deckMeta: { fontSize: 12, color: t.colors.textMuted },
});
