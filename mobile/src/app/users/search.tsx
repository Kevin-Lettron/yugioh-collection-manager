import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { socialApi } from '@/services/socialApi';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { API_URL } from '@/config';
import { useDebounce } from '@/hooks/useDebounce';

type UserRow = {
  id: number;
  username: string;
  profile_picture?: string | null;
};

/**
 * Écran /users/search — recherche de duellistes par pseudo, avec bouton
 * "Suivre" / "Suivi" optimistic UI, débounce 300ms.
 */
export default function UserSearchScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const { user: me } = useAuth();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [results, setResults] = useState<UserRow[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Charge la liste des following au mount pour connaître l'état initial
  useEffect(() => {
    socialApi
      .getFollowing()
      .then((list) => {
        setFollowingIds(new Set((list as UserRow[]).map((u) => u.id)));
      })
      .catch(() => {});
  }, []);

  const runSearch = useCallback(async () => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const list = await socialApi.searchUsers(debounced.trim());
      setResults((list as UserRow[]).filter((u) => u.id !== me?.id));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debounced, me?.id]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const toggleFollow = async (u: UserRow) => {
    const isFollowing = followingIds.has(u.id);
    // Optimistic
    const next = new Set(followingIds);
    if (isFollowing) next.delete(u.id);
    else next.add(u.id);
    setFollowingIds(next);
    try {
      if (isFollowing) await socialApi.unfollow(u.id);
      else await socialApi.follow(u.id);
    } catch (err: any) {
      // Rollback
      const revert = new Set(followingIds);
      setFollowingIds(revert);
      Alert.alert('Erreur', err?.response?.data?.error || 'Action impossible');
    }
  };

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
          <Text style={styles.headerTitle}>Rechercher</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Pseudo d'un duelliste…"
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(u) => u.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 80, gap: 10 }}
          renderItem={({ item }) => {
            const uri = avatarUri(item.profile_picture);
            const initials = (item.username || 'YG').slice(0, 2).toUpperCase();
            const isFollowing = followingIds.has(item.id);
            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
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
                <TouchableOpacity
                  onPress={() => toggleFollow(item)}
                  style={[
                    styles.followBtn,
                    isFollowing ? styles.followBtnActive : styles.followBtnInactive,
                  ]}>
                  <Text
                    style={[
                      styles.followBtnText,
                      isFollowing ? { color: colors.gold } : { color: colors.onGold },
                    ]}>
                    {isFollowing ? 'Suivi' : 'Suivre'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            !loading && debounced ? (
              <View style={styles.center}>
                <Text style={styles.empty}>Aucun duelliste trouvé pour « {debounced} ».</Text>
              </View>
            ) : null
          }
        />
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
    searchWrap: {
      padding: 16,
      backgroundColor: t.colors.bgElev,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    search: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: t.colors.bg,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.gold,
      color: t.colors.text,
      fontSize: 15,
    },
    center: { padding: 30, alignItems: 'center' },
    empty: { color: t.colors.textMuted, textAlign: 'center', fontSize: 14 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingRight: 10,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
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
    avatarText: { fontSize: 14, fontWeight: '900', color: t.colors.onGold },
    username: {
      flex: 1,
      color: t.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },
    followBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
    },
    followBtnActive: {
      backgroundColor: 'transparent',
      borderColor: t.colors.gold,
    },
    followBtnInactive: {
      backgroundColor: t.colors.gold,
      borderColor: t.colors.gold,
    },
    followBtnText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
  });
