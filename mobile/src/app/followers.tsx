import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { socialApi, type FollowUser } from '@/services/socialApi';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { API_URL } from '@/config';
import ChallengeModal from '@/components/ChallengeModal';

type Tab = 'followers' | 'following';

/**
 * `/followers?tab=followers|following` — deux listes (abonnés / abonnements).
 * Chaque ligne : avatar, pastille de présence, timestamp "vu à …", bouton
 * "Défier en duel" (ouvre `ChallengeModal` pré-rempli). Pull-to-refresh + refetch
 * périodique pour rafraîchir les pastilles online (30 s).
 */
function formatLastSeen(iso?: string | null): string {
  if (!iso) return 'Jamais vu';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Jamais vu';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "a l'instant";
  if (min < 60) return `vu il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vu il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `vu il y a ${days} j`;
  return `vu le ${new Date(iso).toLocaleDateString('fr-FR')}`;
}

export default function FollowersScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'followers');
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Cible d'un défi — quand non-null, on ouvre ChallengeModal pré-rempli.
  const [challengeTarget, setChallengeTarget] = useState<{ id: number; username: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const list =
        tab === 'followers'
          ? await socialApi.getFollowers()
          : await socialApi.getFollowing();
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Refetch périodique — la pastille online doit bouger sans reload.
      const iv = setInterval(load, 30_000);
      return () => clearInterval(iv);
    }, [load])
  );

  const avatarUri = (pp?: string | null) => {
    if (!pp) return null;
    if (/^https?:\/\//.test(pp)) return pp;
    return `${String(API_URL || '').replace(/\/api\/?$/, '')}${pp}`;
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Duellistes</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setTab('followers')}
            style={[styles.tab, tab === 'followers' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'followers' && styles.tabTextActive]}>
              Abonnes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('following')}
            style={[styles.tab, tab === 'following' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'following' && styles.tabTextActive]}>
              Abonnements
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 10 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
                tintColor={colors.gold}
              />
            }
            renderItem={({ item }) => {
              const uri = avatarUri(item.profile_picture);
              const initials = (item.username || 'YG').slice(0, 2).toUpperCase();
              const isOnline = Boolean(item.is_online);
              return (
                <View
                  style={[
                    styles.row,
                    { borderColor: isOnline ? colors.success : colors.border },
                  ]}>
                  {/* Avatar + pastille */}
                  <TouchableOpacity
                    style={styles.avatarWrap}
                    onPress={() => router.push(`/user/${item.id}` as any)}
                    activeOpacity={0.7}>
                    <View style={styles.avatar}>
                      {uri ? (
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Text style={styles.avatarText}>{initials}</Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.presenceDot,
                        {
                          backgroundColor: isOnline ? colors.success : colors.textMuted,
                          borderColor: colors.bg,
                        },
                      ]}
                    />
                  </TouchableOpacity>

                  {/* Nom + timestamp */}
                  <TouchableOpacity
                    style={{ flex: 1, minWidth: 0 }}
                    onPress={() => router.push(`/user/${item.id}` as any)}
                    activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.username} numberOfLines={1}>
                        @{item.username}
                      </Text>
                      <Text
                        style={[
                          styles.presenceTag,
                          {
                            color: isOnline ? colors.success : colors.textMuted,
                            borderColor: isOnline ? colors.success : colors.border,
                          },
                        ]}>
                        {isOnline ? '● En ligne' : '○ Hors ligne'}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {isOnline ? 'Actif maintenant' : formatLastSeen(item.last_seen)}
                    </Text>
                  </TouchableOpacity>

                  {/* Bouton Défier */}
                  <TouchableOpacity
                    onPress={() =>
                      setChallengeTarget({ id: item.id, username: item.username })
                    }
                    style={[styles.duelBtn, { borderColor: colors.violet }]}
                    activeOpacity={0.8}>
                    <Text style={[styles.duelBtnText, { color: colors.violet }]}>⚔ Defier</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.empty}>
                  {tab === 'followers'
                    ? 'Aucun abonne pour l\'instant.'
                    : 'Tu ne suis personne pour l\'instant.'}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/users/search' as any)}
                  style={styles.emptyCta}>
                  <Text style={styles.emptyCtaText}>Rechercher un duelliste</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>

      {/* Modal de défi — pré-rempli avec l'user cliqué */}
      <ChallengeModal
        visible={!!challengeTarget}
        targetUsername={challengeTarget?.username || ''}
        targetUserId={challengeTarget?.id}
        onClose={() => setChallengeTarget(null)}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    backBtn: { paddingVertical: 6 },
    backText: {
      fontSize: 12,
      color: t.colors.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: t.colors.text,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: t.colors.bgElev,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: t.colors.gold },
    tabText: {
      fontSize: 11,
      color: t.colors.textMuted,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    tabTextActive: { color: t.colors.gold, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
    empty: { color: t.colors.textMuted, textAlign: 'center', fontSize: 14 },
    emptyCta: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.08)',
    },
    emptyCtaText: {
      color: t.colors.gold,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderLeftWidth: 3,
      gap: 12,
    },
    avatarWrap: { position: 'relative' },
    avatar: {
      width: 48,
      height: 48,
      backgroundColor: t.colors.violet,
      borderWidth: 1,
      borderColor: t.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 24,
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '900',
      color: t.colors.onGold,
    },
    presenceDot: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
    },
    username: {
      color: t.colors.text,
      fontWeight: '700',
      fontSize: 13,
      letterSpacing: 0.5,
    },
    presenceTag: {
      fontSize: 9,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    metaText: {
      marginTop: 3,
      fontSize: 11,
      color: t.colors.textMuted,
    },
    duelBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      backgroundColor: 'rgba(168,85,247,0.10)',
    },
    duelBtnText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
  });
