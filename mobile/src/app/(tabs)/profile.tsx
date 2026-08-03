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
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { deckApi } from '@/services/deckApi';
import { collectionApi } from '@/services/collectionApi';
import { socialApi } from '@/services/socialApi';
import type { CollectionStats, Deck } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, useTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import { ScanFAB } from '@/components/decor/ScanFAB';
import { spacing } from '@/theme/palette';

/**
 * Profile screen — miroir de PhoneFrame `sc-if isProfile` (l.420-466).
 * Hero band 24px dégradé violet transparent, avatar hexagonal 66px « PA » gradient
 * violet→or, @username Orbitron 19px, sub « Gardien du sanctuaire · depuis {année} »,
 * 2 badges (Top 5% or, 1000 scans muted), stats grid 3 col biseautée,
 * section « — Mes decks — » grid 2 col + placeholder « Dresser un deck ».
 */
export default function ProfileScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [myDecks, collectionStats, following, followers] = await Promise.all([
        deckApi.listMine().catch(() => [] as Deck[]),
        collectionApi.stats().catch(() => null),
        socialApi.getFollowing().catch(() => []),
        socialApi.getFollowers().catch(() => []),
      ]);
      setDecks(myDecks);
      setStats(collectionStats);
      setFollowingCount(following.length);
      setFollowerCount(followers.length);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Profil indisponible');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const handleLogout = () => {
    Alert.alert('Se déconnecter ?', 'Tu devras te reconnecter au prochain lancement.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const username = user?.username || 'invité';
  const initials = username.slice(0, 2).toUpperCase();
  // « depuis {année} » — user.created_at n'est pas exposé par /auth/profile,
  // donc on affiche « — À venir » discrètement en tag.
  const yearJoined: number | null = null;

  if (loading) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <AppHeader onPressAvatar={() => router.push('/settings' as any)} />
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppHeader onPressAvatar={handleLogout} />

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
          {/* Hero band — dégradé violet transparent, avatar hex + identité + badges */}
          <View style={styles.heroBand}>
            {/* Layer dégradé violet — RN sans lib gradient : on utilise 3 layers d'opacité */}
            <View style={styles.heroTintTop} pointerEvents="none" />

            <View style={styles.heroRow}>
              {/* Avatar hexagonal placeholder (RN sans clip-path : carré à angles coupés
                  via bordures obliques simulées — on garde un carré pour l'instant, on
                  ajoutera un vrai hex quand react-native-svg sera intégré). */}
              <View style={styles.heroAvatar}>
                <View style={styles.heroAvatarInner}>
                  <Text style={styles.heroAvatarText}>{initials}</Text>
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName} numberOfLines={1}>@{username}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  Gardien du sanctuaire{yearJoined ? ` · depuis ${yearJoined}` : ' · rejoint récemment'}
                </Text>
                <View style={styles.heroBadges}>
                  {/* Badges — pas de data réelle : on affiche "— À venir" plutôt que
                      d'inventer des chiffres. */}
                  <View style={[styles.heroBadge, { borderColor: colors.goldDim }]}>
                    <Text style={[styles.heroBadgeText, { color: colors.gold }]}>
                      Top 5% — À venir
                    </Text>
                  </View>
                  <View style={[styles.heroBadge, { borderColor: colors.border }]}>
                    <Text style={[styles.heroBadgeText, { color: colors.textMuted }]}>
                      1000 scans — À venir
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Grid stats 3 col biseautée */}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Cartes</Text>
                <Text style={styles.statValue}>
                  {stats ? stats.total_cards.toLocaleString('fr-FR') : '—'}
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Decks</Text>
                <Text style={styles.statValue}>{decks.length}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Copies de deck</Text>
                <Text style={styles.statValue}>— À venir</Text>
              </View>
            </View>

            {/* Ligne secondaire : followers / following (data réelle) */}
            <View style={styles.followRow}>
              <TouchableOpacity
                style={styles.followItem}
                onPress={() => router.push('/followers?tab=followers' as any)}>
                <Text style={styles.followValue}>
                  {followerCount === null ? '—' : followerCount}
                </Text>
                <Text style={styles.followLabel}>Abonnés</Text>
              </TouchableOpacity>
              <View style={styles.followSep} />
              <TouchableOpacity
                style={styles.followItem}
                onPress={() => router.push('/followers?tab=following' as any)}>
                <Text style={styles.followValue}>
                  {followingCount === null ? '—' : followingCount}
                </Text>
                <Text style={styles.followLabel}>Abonnements</Text>
              </TouchableOpacity>
            </View>

            {/* CTA rangée : Modifier mon compte + Rechercher */}
            <View style={styles.accountRow}>
              <TouchableOpacity
                style={styles.accountBtn}
                onPress={() => router.push('/settings' as any)}
                activeOpacity={0.8}>
                <Text style={styles.accountBtnText}>⚙  Modifier mon compte</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.accountBtnAlt}
                onPress={() => router.push('/users/search' as any)}
                activeOpacity={0.8}>
                <Text style={styles.accountBtnAltText}>🔍  Rechercher un duelliste</Text>
              </TouchableOpacity>
              {/* Bascule de thème : la refonte v2 avait fait disparaître le seul
                  point d'entrée, qui vivait dans l'ancien en-tête de collection. */}
              <TouchableOpacity
                style={styles.accountBtnAlt}
                onPress={toggleTheme}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={
                  theme.name === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'
                }>
                <Text style={styles.accountBtnAltText}>
                  {theme.name === 'dark' ? '☀  Thème clair' : '☾  Thème sombre'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section Mes decks */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>— Mes decks —</Text>
              <View style={styles.sectionSep} />
            </View>

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
              {/* Placeholder « Dresser un deck » */}
              <TouchableOpacity
                style={styles.deckPlaceholder}
                onPress={() => router.push('/deck/new')}
                activeOpacity={0.75}>
                <View style={styles.deckPlaceholderGlyph}>
                  <View style={styles.deckPlaceholderDiamond} />
                </View>
                <Text style={styles.deckPlaceholderText}>
                  Dresser{'\n'}un deck
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton logout discret en bas */}
          <View style={styles.logoutWrap}>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      <ScanFAB />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // ─── Hero band ────────────────────────────────
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
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    // Approximation hex : 66×66 avec fond dégradé simulé par 2 layers
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
    heroBadges: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    heroBadge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderWidth: 1,
    },
    heroBadgeText: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontWeight: '700',
    },

    // ─── Stats grid 3 col ─────────────────────────
    statsGrid: {
      marginTop: 18,
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
      textAlign: 'center',
    },
    statValue: {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: '700',
      color: t.colors.text,
      textAlign: 'center',
    },

    // ─── Follow row (sous stats) ──────────────────
    followRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    followItem: { alignItems: 'center', paddingHorizontal: 10 },
    followValue: {
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: '700',
      color: t.colors.text,
    },
    followLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1.4,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    followSep: { width: 1, height: 26, backgroundColor: t.colors.border },

    // ─── Section decks ────────────────────────────
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
    sectionSep: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border,
    },

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

    deckPlaceholder: {
      width: '48%',
      padding: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 120,
    },
    deckPlaceholderGlyph: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deckPlaceholderDiamond: {
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: t.colors.goldDim,
      transform: [{ rotate: '45deg' }],
      opacity: 0.6,
    },
    deckPlaceholderText: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      textAlign: 'center',
    },

    // ─── Logout ──────────────────────────────────
    logoutWrap: {
      marginTop: spacing[6],
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    logoutText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
      fontWeight: '700',
    },

    // ─── Account CTA ─────────────────────────────
    accountRow: {
      marginTop: 18,
      gap: 8,
    },
    accountBtn: {
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.gold,
      alignItems: 'center',
    },
    accountBtnText: {
      color: t.colors.gold,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    accountBtnAlt: {
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.violet,
      alignItems: 'center',
    },
    accountBtnAltText: {
      color: t.colors.violet,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
  });
