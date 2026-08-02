import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { socialApi, type PublicUserProfile } from '@/services/socialApi';
import type { Deck } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';

/**
 * User profile screen (autre user) — même syntaxe visuelle que profile.tsx :
 * hero band + stats + section Mes decks. Sans logout, avec CTA « Suivre / Suivi »
 * en haut.
 *
 * Le back /auth/users/:id retourne {user, followerCount, followingCount} — les
 * decks du user sont récupérés à part via /decks/public?user_id=X.
 */
export default function UserProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const targetId = Number(id);
  const router = useRouter();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!targetId || Number.isNaN(targetId)) return;
    try {
      const [prof, feed, followingList] = await Promise.all([
        socialApi.getUser(targetId),
        socialApi
          .feed({ user_id: targetId, page: 1, limit: 40 })
          .catch(() => ({ data: [] as Deck[], total: 0, page: 1, total_pages: 0 })),
        me ? socialApi.getFollowing().catch(() => []) : Promise.resolve([]),
      ]);
      setProfile(prof);
      setDecks(feed.data);
      setIsFollowing(followingList.some((f) => f.id === targetId));
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Profil introuvable');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetId, router, me]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const handleFollowToggle = async () => {
    if (!me) {
      Alert.alert('Connexion requise', 'Connecte-toi pour suivre ce duelliste.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Se connecter', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const was = isFollowing;
    setIsFollowing(!was); // optimistic
    try {
      if (was) await socialApi.unfollow(targetId);
      else await socialApi.follow(targetId);
    } catch (err: any) {
      setIsFollowing(was);
      Alert.alert('Erreur', err?.response?.data?.error || 'Action échouée');
    } finally {
      setFollowBusy(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  const username = profile.user.username;
  const initials = username.slice(0, 2).toUpperCase();
  const yearJoined = profile.user.created_at
    ? new Date(profile.user.created_at).getFullYear()
    : null;
  const isMe = !!me && me.id === targetId;

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Chrome header : back + title minimal */}
        <View style={styles.chromeHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchAll();
              }}
              tintColor={colors.gold}
            />
          }>
          {/* Hero band */}
          <View style={styles.heroBand}>
            <View style={styles.heroTintTop} pointerEvents="none" />

            <View style={styles.heroRow}>
              <View style={styles.heroAvatar}>
                <View style={styles.heroAvatarInner}>
                  <Text style={styles.heroAvatarText}>{initials}</Text>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName} numberOfLines={1}>@{username}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  Gardien du sanctuaire{yearJoined ? ` · depuis ${yearJoined}` : ''}
                </Text>
                {profile.user.bio ? (
                  <Text style={styles.heroBio} numberOfLines={3}>{profile.user.bio}</Text>
                ) : null}
              </View>
            </View>

            {/* CTA Suivre — pas visible si c'est notre propre profil */}
            {!isMe && (
              <TouchableOpacity
                onPress={handleFollowToggle}
                disabled={followBusy}
                style={[
                  styles.ctaFollow,
                  isFollowing && { borderColor: colors.textMuted, backgroundColor: colors.panel2 },
                ]}
                activeOpacity={0.85}>
                <Text
                  style={[
                    styles.ctaFollowText,
                    isFollowing && { color: colors.textMuted },
                  ]}>
                  {isFollowing ? 'Suivi' : 'Suivre'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Stats grid 3 col */}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Decks</Text>
                <Text style={styles.statValue}>{decks.length}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Abonnés</Text>
                <Text style={styles.statValue}>{profile.followerCount}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Suit</Text>
                <Text style={styles.statValue}>{profile.followingCount}</Text>
              </View>
            </View>
          </View>

          {/* Section decks publics */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>— Decks publics —</Text>
              <View style={styles.sectionSep} />
            </View>

            {decks.length === 0 ? (
              <Text style={styles.emptyDecks}>
                Ce duelliste n&apos;a pas encore de deck public.
              </Text>
            ) : (
              <View style={styles.deckGrid}>
                {decks.map((d) => {
                  const mainCount = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  const extraCount = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.deckCard}
                      onPress={() => router.push(`/deck/${d.id}`)}
                      activeOpacity={0.8}>
                      <View style={styles.deckFan}>
                        <View style={[styles.deckMini, styles.deckMiniA, { borderColor: 'rgba(245,197,24,0.4)' }]} />
                        <View style={[styles.deckMini, styles.deckMiniB, { borderColor: 'rgba(168,85,247,0.4)' }]} />
                      </View>
                      <Text style={styles.deckName} numberOfLines={1}>{d.name}</Text>
                      <View style={styles.deckMeta}>
                        <Text style={styles.deckCount}>
                          {mainCount} · {extraCount}
                        </Text>
                        <Text style={styles.deckLikes}>♥ {d.likes_count ?? 0}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    chromeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    chromeBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chromeBtnText: { fontSize: 22, color: t.colors.text },

    heroBand: {
      position: 'relative',
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      overflow: 'hidden',
    },
    heroTintTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 120,
      backgroundColor: 'rgba(168,85,247,0.14)',
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    heroAvatar: {
      width: 66,
      height: 66,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: t.colors.violet,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroAvatarInner: {
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(194,154,15,0.35)',
    },
    heroAvatarText: {
      fontFamily: 'sans-serif',
      fontSize: 22,
      fontWeight: '900',
      color: t.colors.onGold,
      letterSpacing: 0.5,
    },
    heroName: {
      fontFamily: 'sans-serif',
      fontSize: 19,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    heroSub: {
      marginTop: 3,
      fontSize: 12,
      color: t.colors.textMuted,
    },
    heroBio: {
      marginTop: 8,
      fontSize: 12,
      color: t.colors.text,
      lineHeight: 17,
    },

    ctaFollow: {
      marginTop: 14,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: 'rgba(245,197,24,0.10)',
      borderWidth: 1,
      borderColor: t.colors.gold,
    },
    ctaFollowText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: t.colors.gold,
      fontWeight: '700',
    },

    statsGrid: {
      marginTop: 16,
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.border,
      gap: 1,
    },
    statCell: {
      flex: 1,
      paddingVertical: 11,
      paddingHorizontal: 10,
      backgroundColor: t.colors.panel,
      alignItems: 'center',
      gap: 2,
    },
    statLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 2,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    statValue: {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.text,
    },

    section: {
      paddingHorizontal: 20,
      paddingTop: 18,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color: t.colors.gold,
      fontWeight: '700',
    },
    sectionSep: { flex: 1, height: 1, backgroundColor: t.colors.border },

    deckGrid: {
      marginTop: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    deckCard: {
      width: '48%',
      padding: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 4,
    },
    deckFan: {
      height: 46,
      flexDirection: 'row',
      alignItems: 'center',
    },
    deckMini: {
      width: 30,
      height: 44,
      borderWidth: 1,
      backgroundColor: t.colors.panel2,
    },
    deckMiniA: { transform: [{ rotate: '-6deg' }] },
    deckMiniB: { marginLeft: -10, transform: [{ rotate: '6deg' }] },
    deckName: {
      marginTop: 4,
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    deckMeta: {
      marginTop: 3,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    deckCount: { fontSize: 10, color: t.colors.textMuted, fontWeight: '600' },
    deckLikes: { fontSize: 10, color: t.colors.magenta, fontWeight: '700' },

    emptyDecks: {
      marginTop: 24,
      textAlign: 'center',
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
    },
  });
