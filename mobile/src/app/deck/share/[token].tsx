import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { deckApi } from '@/services/deckApi';
import { socialApi } from '@/services/socialApi';
import type { Deck, DeckStats } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';

const CARD_ICON = require('@/assets/images/decor/glyph-pyramid.png');

/**
 * Vue publique d'un deck partagé — accessible sans auth via /decks/shared/:token.
 * Layout inspiré de deck/[id].tsx variante « arena » avec plateau 3D placeholder.
 * CTA « Copier ce deck » : si logged in → wishlist ; sinon → écran login.
 */
export default function SharedDeckScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDeck = useCallback(async () => {
    if (!token) return;
    try {
      const res = await deckApi.getShared(token);
      setDeck(res.deck);
      setStats(res.stats || null);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Deck introuvable ou lien expiré');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useFocusEffect(
    useCallback(() => {
      fetchDeck();
    }, [fetchDeck])
  );

  const mainCount = useMemo(
    () => deck?.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0,
    [deck]
  );
  const extraCount = useMemo(
    () => deck?.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0,
    [deck]
  );

  const handleCopy = async () => {
    if (!deck) return;
    if (!user) {
      Alert.alert('Connexion requise', 'Connecte-toi pour copier ce deck dans ta wishlist.', [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Se connecter', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    if (copyBusy) return;
    setCopyBusy(true);
    try {
      await socialApi.wishlist(deck.id);
      setCopied(true);
      Alert.alert('Deck ajouté', 'Il t\'attend dans ta wishlist.');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Copie échouée';
      Alert.alert('Erreur', msg);
    } finally {
      setCopyBusy(false);
    }
  };

  if (loading || !deck) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  const authorName = deck.user?.username || 'anonyme';

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.chromeHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Header du deck partagé */}
          <View style={styles.deckHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kicker}>— Vitrine partagée —</Text>
              <Text style={styles.title} numberOfLines={2}>{deck.name}</Text>
              <Text style={styles.authorLine}>
                par <Text style={{ color: colors.violet }}>@{authorName}</Text>
                {' · '}
                <Text style={{ color: colors.gold }}>lien public</Text>
              </Text>
            </View>
          </View>

          {/* Plateau 3D placeholder — variante arena */}
          <View style={styles.arenaBoard}>
            <View style={styles.arenaGrid}>
              <View style={styles.arenaZoneRow}>
                {[true, true, true, false, false].map((filled, i) => (
                  <View
                    key={`b-${i}`}
                    style={[
                      styles.arenaZone,
                      filled
                        ? { borderColor: colors.rarityUltra, backgroundColor: colors.panel2 }
                        : styles.arenaZoneEmpty,
                    ]}>
                    {filled && <Text style={styles.arenaZoneLabel}>M</Text>}
                  </View>
                ))}
              </View>
              <View style={styles.arenaZoneRow}>
                {[
                  { filled: true, color: colors.raritySuper, label: 'S' },
                  { filled: true, color: colors.raritySuper, label: 'S' },
                  { filled: false, color: null, label: '' },
                  { filled: true, color: colors.raritySecret2, label: 'T' },
                  { filled: false, color: null, label: '' },
                ].map((z, i) => (
                  <View
                    key={`f-${i}`}
                    style={[
                      styles.arenaZone,
                      z.filled
                        ? { borderColor: z.color!, backgroundColor: colors.panel2 }
                        : styles.arenaZoneEmpty,
                    ]}>
                    {z.filled && <Text style={styles.arenaZoneLabel}>{z.label}</Text>}
                  </View>
                ))}
              </View>

              {/* Compteurs main/extra/side biseautés */}
              <View style={styles.arenaCounters}>
                <View style={styles.arenaCounter}>
                  <Text style={styles.arenaCounterLabel}>Main</Text>
                  <Text style={[styles.arenaCounterVal, { color: colors.gold }]}>{mainCount}</Text>
                </View>
                <View style={styles.arenaCounter}>
                  <Text style={styles.arenaCounterLabel}>Extra</Text>
                  <Text style={[styles.arenaCounterVal, { color: colors.violet }]}>{extraCount}</Text>
                </View>
                <View style={styles.arenaCounter}>
                  <Text style={styles.arenaCounterLabel}>Valeur</Text>
                  <Text style={[styles.arenaCounterVal, { color: colors.cyan }]}>
                    {stats
                      ? stats.total_value_eur.toLocaleString('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        })
                      : '—'}
                  </Text>
                </View>
              </View>

              <Text style={styles.arenaComingSoon}>— Plateau 3D interactif à venir —</Text>
            </View>
          </View>

          {/* Cartes clés — horizontal scroll */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Cartes clés</Text>
            <View style={styles.sectionSep} />
          </View>

          {(deck.main_deck?.length ?? 0) === 0 ? (
            <Text style={styles.emptyDeck}>Deck principal vide.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
              {(deck.main_deck || []).slice(0, 8).map((dc) => (
                <View key={dc.id} style={styles.keyCardWrap}>
                  <View style={styles.keyCardArt}>
                    {dc.card?.card_images?.[0]?.image_url_small ? (
                      <Image
                        source={{ uri: dc.card.card_images[0].image_url_small }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={CARD_ICON}
                        style={{ width: '55%', height: '55%', tintColor: colors.gold, opacity: 0.3 }}
                        resizeMode="contain"
                      />
                    )}
                    <View style={styles.keyCardQty}>
                      <Text style={styles.keyCardQtyText}>×{dc.quantity}</Text>
                    </View>
                  </View>
                  <Text style={styles.keyCardName} numberOfLines={1}>
                    {dc.card?.name || '—'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* CTA principal — Copier ce deck */}
          <View style={styles.ctaRow}>
            <View style={{ flex: 1 }}>
              <CyberButton
                label={copied ? 'Ajouté ✓' : user ? 'Copier ce deck' : 'Se connecter pour copier'}
                variant="primary"
                block
                cutColor={colors.bg}
                loading={copyBusy}
                disabled={copied}
                onPress={handleCopy}
              />
            </View>
          </View>

          {/* Note info sous CTA */}
          <Text style={styles.footNote}>
            Vitrine publique en lecture seule. Copie le deck pour le retrouver dans ton sanctuaire.
          </Text>
        </ScrollView>
      </SafeAreaView>
      <CornerOrnaments />
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
    body: { padding: 18, paddingBottom: 96, gap: 6 },

    // ── Header du deck
    deckHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.8,
      color: t.colors.gold,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 4,
      fontFamily: 'sans-serif',
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.colors.text,
      lineHeight: 24,
    },
    authorLine: {
      marginTop: 6,
      fontSize: 12,
      color: t.colors.textMuted,
    },

    // ── Arena board
    arenaBoard: {
      marginTop: 18,
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      position: 'relative',
      overflow: 'hidden',
    },
    arenaGrid: { gap: 9 },
    arenaZoneRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 7,
    },
    arenaZone: {
      width: 38,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    arenaZoneEmpty: {
      borderStyle: 'dashed',
      borderColor: 'rgba(245,197,24,0.22)',
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    arenaZoneLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      color: t.colors.textMuted,
      letterSpacing: 0.8,
      opacity: 0.75,
    },
    arenaCounters: {
      marginTop: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    arenaCounter: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
    },
    arenaCounterLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 1.6,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    arenaCounterVal: {
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 2,
    },
    arenaComingSoon: {
      marginTop: 8,
      textAlign: 'center',
      fontStyle: 'italic',
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 1,
    },

    // ── Cartes clés
    keyCardWrap: { width: 88 },
    keyCardArt: {
      width: 88,
      height: 124,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    keyCardQty: {
      position: 'absolute',
      top: 5,
      right: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: t.colors.bg,
      borderWidth: 1,
      borderColor: t.colors.gold,
    },
    keyCardQtyText: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      fontWeight: '700',
      color: t.colors.gold,
    },
    keyCardName: {
      marginTop: 5,
      fontFamily: 'sans-serif',
      fontSize: 8,
      color: t.colors.text,
    },

    // ── Sections / CTA
    sectionRow: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      color: t.colors.gold,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    sectionSep: { flex: 1, height: 1, backgroundColor: t.colors.border },
    ctaRow: { marginTop: 18, flexDirection: 'row', gap: 10 },
    emptyDeck: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      padding: 12,
    },
    footNote: {
      marginTop: 14,
      textAlign: 'center',
      fontSize: 11,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      paddingHorizontal: 12,
    },
  });
