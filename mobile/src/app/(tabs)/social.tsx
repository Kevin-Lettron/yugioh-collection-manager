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
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { socialApi, type UserSearchResult, type FollowUser } from '@/services/socialApi';
import type { Deck } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import { ScanFAB } from '@/components/decor/ScanFAB';
import { spacing } from '@/theme/palette';

/** Modes de tri du feed — miroir des chips PhoneFrame l.386-390. */
type SortMode = 'popular' | 'recent' | 'following';
type FeedTab = 'decks' | 'users';

const SORT_OPTIONS: Array<{ key: SortMode; label: string }> = [
  { key: 'popular', label: 'Populaires' },
  { key: 'recent', label: 'Récents' },
  { key: 'following', label: 'Suivis' },
];

const SEARCH_ICON = require('@/assets/images/ui/i-search.png');

/**
 * Petites variantes de "wash" coloré posé sur le header de chaque card — repris
 * de {{ post.wash }} de PhoneFrame l.396. Le back ne fournit pas cette valeur ;
 * on la calcule côté client à partir de l'id du deck pour rester stable.
 */
const WASH_TINTS = [
  'rgba(245,197,24,0.14)', // or
  'rgba(168,85,247,0.14)', // violet
  'rgba(34,211,238,0.12)', // cyan
  'rgba(255,46,136,0.12)', // rose
];

/** Tags de section stylisés en top-right des cards — placeholder tant qu'on n'a
 *  pas de tags backend (thèmes, archétypes). */
const TAG_POOL = ['Contrôle', 'Aggro', 'Combo', 'Mid-range', 'Stall', 'Burn'];

const pickWash = (id: number) => WASH_TINTS[id % WASH_TINTS.length];
const pickTag = (id: number) => TAG_POOL[id % TAG_POOL.length];

export default function SocialScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();

  const [tab, setTab] = useState<FeedTab>('decks');
  const [sort, setSort] = useState<SortMode>('popular');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // ── Fetch decks feed + set des IDs suivis (utile en mode « Suivis » côté
  //    client, faute d'endpoint /decks/feed dédié).
  const fetchDecksFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, followList] = await Promise.all([
        socialApi.feed({ page: 1, limit: 40, search: debouncedSearch || undefined }),
        socialApi.getFollowing().catch(() => [] as FollowUser[]),
      ]);
      setDecks(feed.data);
      setFollowing(new Set(followList.map((f) => f.id)));
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Feed indisponible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [list, followList] = await Promise.all([
        socialApi.searchUsers(debouncedSearch || undefined),
        socialApi.getFollowing().catch(() => [] as FollowUser[]),
      ]);
      setUsers(list);
      setFollowing(new Set(followList.map((f) => f.id)));
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Recherche indisponible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch]);

  useFocusEffect(
    useCallback(() => {
      if (tab === 'decks') fetchDecksFeed();
      else fetchUsers();
    }, [tab, fetchDecksFeed, fetchUsers])
  );

  const sortedDecks = useMemo(() => {
    const arr = [...decks];
    if (sort === 'popular') {
      arr.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0));
    } else if (sort === 'recent') {
      arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    } else {
      // 'following' — on ne garde que les decks des users suivis
      return arr.filter((d) => (d.user_id ? following.has(d.user_id) : false));
    }
    return arr;
  }, [decks, sort, following]);

  const handleFollowToggle = async (u: UserSearchResult) => {
    const wasFollowing = following.has(u.id);
    // Optimistic
    setFollowing((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(u.id);
      else next.add(u.id);
      return next;
    });
    try {
      if (wasFollowing) await socialApi.unfollow(u.id);
      else await socialApi.follow(u.id);
    } catch (err: any) {
      // Rollback
      setFollowing((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(u.id);
        else next.delete(u.id);
        return next;
      });
      Alert.alert('Erreur', err?.response?.data?.error || 'Action échouée');
    }
  };

  // ─── Header + tabs
  const listHeader = (
    <View style={styles.contentPadding}>
      <View style={styles.headerBlock}>
        <Text style={styles.kicker}>— Vitrines ouvertes —</Text>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.sub}>
          Le sanctuaire des maîtres du jeu.
        </Text>
      </View>

      {/* Toggle Decks / Users */}
      <View style={styles.tabRow}>
        {(['decks', 'users'] as FeedTab[]).map((t) => {
          const active = t === tab;
          return (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabBtn,
                active && { borderColor: colors.gold, backgroundColor: 'rgba(245,197,24,0.06)' },
              ]}>
              <Text
                style={[
                  styles.tabBtnLabel,
                  active && { color: colors.gold },
                ]}>
                {t === 'decks' ? 'Decks' : 'Duellistes'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Chips sort (visibles uniquement en mode decks) */}
      {tab === 'decks' && (
        <View style={styles.chipsRow}>
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setSort(opt.key)}
                style={[
                  styles.chip,
                  active && { backgroundColor: colors.gold, borderColor: colors.gold },
                ]}>
                <Text style={[styles.chipLabel, active && { color: colors.onGold }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Recherche */}
      <View style={styles.searchWrap}>
        <Image
          source={SEARCH_ICON}
          style={styles.searchIcon}
          resizeMode="contain"
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'decks' ? 'Cherche un deck…' : 'Cherche un duelliste…'}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      <View style={{ height: 12 }} />
    </View>
  );

  const renderDeckCard = ({ item }: { item: Deck }) => {
    const authorName = item.user?.username || 'anonyme';
    const likes = item.likes_count ?? 0;
    const comments = item.comments_count ?? 0;
    // Placeholder pour le ratio like/dislike — pas fourni par le back.
    const totalReactions = likes + (item.dislikes_count ?? 0);
    const ratio = totalReactions > 0 ? `${Math.round((likes / totalReactions) * 100)}%` : '—';
    const wash = pickWash(item.id);
    const tag = pickTag(item.id);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/deck/${item.id}`)}
        activeOpacity={0.85}
        style={styles.feedCard}>
        {/* Header 96px — fan 3 mini-cartes rotate -8/4/13deg + wash coloré + tag TR */}
        <View style={styles.feedHeader}>
          <View style={[styles.feedWash, { backgroundColor: wash }]} pointerEvents="none" />
          <View style={styles.feedFan} pointerEvents="none">
            <View style={[styles.feedMiniCard, styles.miniCardA, { borderColor: 'rgba(245,197,24,0.5)' }]} />
            <View style={[styles.feedMiniCard, styles.miniCardB, { borderColor: 'rgba(168,85,247,0.5)' }]} />
            <View style={[styles.feedMiniCard, styles.miniCardC, { borderColor: 'rgba(34,211,238,0.45)' }]} />
          </View>
          <View style={styles.feedTag}>
            <Text style={styles.feedTagText}>{tag}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.feedBody}>
          <Text style={styles.feedName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.feedAuthorLine}>
            par <Text style={{ color: colors.violet }}>@{authorName}</Text>
            {item.updated_at ? ' · maj récente' : ''}
          </Text>
          <View style={styles.feedMetaRow}>
            <Text style={styles.feedLikes}>♥ {likes}</Text>
            <Text style={styles.feedComments}>◦ {comments}</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.feedRatio}>{ratio}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserCard = ({ item }: { item: UserSearchResult }) => {
    const isFollowing = following.has(item.id);
    const initials = (item.username || 'YG').slice(0, 2).toUpperCase();

    return (
      <View style={styles.userCard}>
        <TouchableOpacity
          style={styles.userLeft}
          onPress={() => router.push(`/user/${item.id}`)}
          activeOpacity={0.75}>
          {/* Avatar hex placeholder — clip-path polygon non dispo en RN,
              on approxime par un View carré arrondi avec fond dégradé. */}
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>@{item.username}</Text>
            <Text style={styles.userSub} numberOfLines={1}>
              {item.bio || 'Duelliste du sanctuaire'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.followBtn,
            isFollowing && { borderColor: colors.textMuted, backgroundColor: colors.panel2 },
          ]}
          onPress={() => handleFollowToggle(item)}
          activeOpacity={0.8}>
          <Text
            style={[
              styles.followBtnText,
              isFollowing && { color: colors.textMuted },
            ]}>
            {isFollowing ? 'Suivi' : 'Suivre'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const emptyLabel = tab === 'decks'
    ? (sort === 'following'
        ? 'Suis quelques duellistes pour voir leurs decks apparaître ici.'
        : 'Aucun deck public trouvé.')
    : 'Aucun duelliste trouvé.';

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader />

        {loading && decks.length === 0 && users.length === 0 ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : tab === 'decks' ? (
          <FlatList
            data={sortedDecks}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderDeckCard}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchDecksFeed();
                }}
                tintColor={colors.gold}
              />
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{emptyLabel}</Text>
                </View>
              ) : null
            }
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUserCard}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchUsers();
                }}
                tintColor={colors.gold}
              />
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{emptyLabel}</Text>
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

    // ─── Header block ────────────────────────────────
    headerBlock: {
      paddingBottom: 14,
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
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
      lineHeight: 30,
    },
    sub: {
      marginTop: 6,
      fontSize: 13,
      color: t.colors.textMuted,
      letterSpacing: 0.5,
    },

    // ─── Toggle tabs decks / duellistes ──────────────
    tabRow: {
      marginTop: 14,
      flexDirection: 'row',
      gap: 8,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    tabBtnLabel: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.colors.text,
    },

    // ─── Chips sort ─────────────────────────────────
    chipsRow: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 6,
    },
    chip: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
      alignItems: 'center',
    },
    chipLabel: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },

    // ─── Search ─────────────────────────────────────
    searchWrap: {
      marginTop: 12,
      position: 'relative',
    },
    searchIcon: {
      position: 'absolute',
      left: 12,
      top: 13,
      width: 16,
      height: 16,
      tintColor: t.colors.gold,
      zIndex: 2,
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

    // ─── Feed card (deck) ───────────────────────────
    feedCard: {
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      overflow: 'hidden',
    },
    feedHeader: {
      height: 96,
      backgroundColor: t.colors.panel2,
      position: 'relative',
      overflow: 'hidden',
    },
    feedWash: {
      ...StyleSheet.absoluteFillObject,
    },
    feedFan: {
      position: 'absolute',
      left: 14,
      top: 14,
      flexDirection: 'row',
    },
    feedMiniCard: {
      width: 44,
      height: 66,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
    },
    miniCardA: { transform: [{ rotate: '-8deg' }] },
    miniCardB: { marginLeft: -14, transform: [{ rotate: '4deg' }], zIndex: 2 },
    miniCardC: { marginLeft: -14, transform: [{ rotate: '13deg' }] },
    feedTag: {
      position: 'absolute',
      right: 12,
      top: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: 'rgba(11,9,6,0.8)',
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    feedTagText: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 1.4,
      color: t.colors.goldDim,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    feedBody: {
      padding: 14,
    },
    feedName: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.3,
    },
    feedAuthorLine: {
      marginTop: 4,
      fontSize: 12,
      color: t.colors.textMuted,
    },
    feedMetaRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    feedLikes: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.magenta,
      fontWeight: '700',
    },
    feedComments: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.textMuted,
      fontWeight: '700',
    },
    feedRatio: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.gold,
      fontWeight: '700',
    },

    // ─── User card ──────────────────────────────────
    userCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    userLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    userAvatar: {
      width: 44,
      height: 44,
      backgroundColor: t.colors.violet,
      borderWidth: 1,
      borderColor: t.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarText: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '900',
      color: t.colors.onGold,
    },
    userName: {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.5,
    },
    userSub: {
      marginTop: 2,
      fontSize: 11,
      color: t.colors.textMuted,
    },
    followBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.10)',
    },
    followBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },

    // ─── Empty ──────────────────────────────────────
    emptyState: {
      padding: spacing[7],
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: t.colors.textMuted,
      textAlign: 'center',
    },
  });
