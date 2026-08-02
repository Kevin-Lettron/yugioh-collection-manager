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
import { socialApi } from '@/services/socialApi';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { API_URL } from '@/config';

type Tab = 'followers' | 'following';
type UserRow = {
  id: number;
  username: string;
  profile_picture?: string | null;
};

/**
 * Écran /followers?tab=followers|following — deux listes en tabs (abonnés / abonnements).
 * Chaque row = avatar + username, tap = nav vers /user/[id]. Pull-to-refresh.
 */
export default function FollowersScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>((params.tab as Tab) || 'followers');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = tab === 'followers' ? await socialApi.getFollowers() : await socialApi.getFollowing();
      setUsers(list as unknown as UserRow[]);
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
              Abonnés
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
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => router.push(`/user/${item.id}` as any)}
                  activeOpacity={0.7}>
                  <View style={styles.avatar}>
                    {uri ? (
                      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={styles.avatarText}>{initials}</Text>
                    )}
                  </View>
                  <Text style={styles.username}>@{item.username}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.empty}>
                  {tab === 'followers'
                    ? 'Aucun abonné pour l\'instant.'
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
      borderColor: t.colors.border,
      gap: 12,
    },
    avatar: {
      width: 44,
      height: 44,
      backgroundColor: t.colors.violet,
      borderWidth: 1,
      borderColor: t.colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '900',
      color: t.colors.onGold,
    },
    username: {
      flex: 1,
      color: t.colors.text,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.5,
    },
  });
