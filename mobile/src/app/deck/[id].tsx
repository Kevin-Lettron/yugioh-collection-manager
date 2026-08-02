import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { deckApi } from '@/services/deckApi';
import { socialApi } from '@/services/socialApi';
import type { Deck, DeckCard, DeckComment, DeckStats } from '@/types';
import { API_URL } from '@/config';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { spacing } from '@/theme/palette';

const CARD_ICON = require('@/assets/images/decor/glyph-pyramid.png'); // placeholder svg-card icon

type ViewMode = 'arena' | 'list';

/**
 * DeckView — implémente les deux variantes du PhoneFrame :
 *   • sc-if `isArena` (l.190-260) — variante A « Sanctuaire draconique » avec
 *     plateau 3D perspective + zones + compteurs + Cartes clés scrollables.
 *   • sc-if `isList`  (l.262-323) — variante B « grimoire » avec jauge répartition
 *     et sections Deck principal / Extra / Side en rows biseautés.
 * Toggle « Vue arène ↔ Vue liste » en haut à droite du header.
 */
export default function DeckViewScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [stats, setStats] = useState<DeckStats | null>(null);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('arena');

  // Wishlist (« copier deck ») + follow author — état local optimistic, resynchro
  // depuis /social/wishlist et /social/following à chaque fetchAll.
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [res, c] = await Promise.all([
        deckApi.get(deckId),
        deckApi.listComments(deckId).catch(() => [] as DeckComment[]),
      ]);
      setDeck(res.deck);
      setStats(res.stats || null);
      setComments(c);

      // Enrichissement social — le back n'ajoute pas is_wishlisted / is_following
      // aux réponses /decks/:id ; on croise avec les listes /social/wishlist et
      // /social/following. Les échecs sont silencieux (user pas connecté, etc.).
      if (user) {
        try {
          const wl = await socialApi.getWishlist();
          setWishlisted(wl.some((w) => w.deck_id === deckId));
        } catch {
          /* wishlist indisponible : on garde l'état par défaut */
        }
        if (res.deck.user_id && res.deck.user_id !== user.id) {
          try {
            const following = await socialApi.getFollowing();
            setIsFollowing(following.some((f) => f.id === res.deck.user_id));
          } catch {
            /* follow indisponible */
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Deck introuvable');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deckId, router, user]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const isOwner = !!(deck && user && deck.user_id === user.id);

  const handleReaction = async () => {
    if (!deck || reacting) return;
    setReacting(true);
    try {
      if (deck.user_reaction === 'like') {
        await deckApi.clearReaction(deckId);
      } else {
        await deckApi.like(deckId);
      }
      await fetchAll();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Réaction échouée');
    } finally {
      setReacting(false);
    }
  };

  const handleShare = async () => {
    if (!deck) return;
    try {
      let token = deck.share_token;
      if (!token) {
        const res = await deckApi.generateShare(deckId);
        token = res.shareToken;
        await fetchAll();
      }
      const url = `${API_URL}/deck/share/${token}`;
      await Share.share({ message: `Regarde mon deck "${deck.name}" : ${url}`, url });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Partage échoué');
    }
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || postingComment) return;
    setPostingComment(true);
    try {
      await deckApi.createComment(deckId, text);
      setCommentText('');
      const c = await deckApi.listComments(deckId);
      setComments(c);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Commentaire échoué');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = (comment: DeckComment) => {
    Alert.alert('Supprimer ce commentaire ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deckApi.deleteComment(comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.error || 'Suppression échouée');
          }
        },
      },
    ]);
  };

  const handleWishlistToggle = async () => {
    if (!deck || wishlistBusy) return;
    if (!user) {
      Alert.alert('Connexion requise', 'Connecte-toi pour copier ce deck dans ta wishlist.');
      return;
    }
    setWishlistBusy(true);
    const was = wishlisted;
    setWishlisted(!was); // optimistic
    try {
      if (was) await socialApi.unwishlist(deck.id);
      else await socialApi.wishlist(deck.id);
    } catch (err: any) {
      setWishlisted(was);
      Alert.alert('Erreur', err?.response?.data?.error || 'Copie échouée');
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!deck?.user_id || followBusy) return;
    if (!user) {
      Alert.alert('Connexion requise', "Connecte-toi pour suivre l'auteur.");
      return;
    }
    setFollowBusy(true);
    const was = isFollowing;
    setIsFollowing(!was); // optimistic
    try {
      if (was) await socialApi.unfollow(deck.user_id);
      else await socialApi.follow(deck.user_id);
    } catch (err: any) {
      setIsFollowing(was);
      Alert.alert('Erreur', err?.response?.data?.error || 'Action échouée');
    } finally {
      setFollowBusy(false);
    }
  };

  const mainCount = useMemo(
    () => deck?.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0,
    [deck]
  );
  const extraCount = useMemo(
    () => deck?.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0,
    [deck]
  );

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

  const liked = deck.user_reaction === 'like';
  const authorName = isOwner ? 'toi' : deck.user?.username || 'anonyme';

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Mini-header : back + share */}
        <View style={styles.chromeHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleShare} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>↗</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={80}>
          <ScrollView
            contentContainerStyle={styles.body}
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
            {/* Header du deck : kicker + titre + author line + like/comment badges */}
            <View style={styles.deckHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.kicker}>
                  {viewMode === 'arena' ? '— Arène · Variante A —' : '— Grimoire · Variante B —'}
                </Text>
                <Text style={styles.title} numberOfLines={2}>
                  {deck.name}
                </Text>
                <Text style={styles.authorLine}>
                  par <Text style={{ color: colors.violet }}>@{authorName}</Text>
                  {viewMode === 'list'
                    ? ` · ${mainCount} · ${extraCount} · 0`
                    : ' · mis à jour récemment'}
                </Text>
              </View>

              <View style={styles.actionsCol}>
                <TouchableOpacity
                  onPress={handleReaction}
                  disabled={reacting}
                  style={[
                    styles.likeBtn,
                    liked && {
                      borderColor: colors.magenta,
                      backgroundColor: 'rgba(255,46,136,0.16)',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.likeText,
                      { color: liked ? colors.magenta : colors.textMuted, fontSize: 12 },
                    ]}>
                    ♥ {deck.likes_count ?? 0}
                  </Text>
                </TouchableOpacity>

                <View style={styles.commentBadge}>
                  <Text style={[styles.likeText, { fontSize: 12 }]}>◦ {comments.length}</Text>
                </View>
              </View>
            </View>

            {/* Toggle Arène / Liste — bouton biseauté droite (PhoneFrame l.257 / l.320) */}
            <View style={styles.viewToggleRow}>
              <TouchableOpacity
                onPress={() => setViewMode(viewMode === 'arena' ? 'list' : 'arena')}
                style={styles.viewToggle}>
                <Text style={styles.viewToggleText}>
                  {viewMode === 'arena' ? 'Vue liste →' : '← Vue arène'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ═══ VUE ARÈNE ═══ */}
            {viewMode === 'arena' ? (
              <ArenaBlock
                mainCount={mainCount}
                extraCount={extraCount}
                mainDeck={deck.main_deck || []}
                colors={colors}
                styles={styles}
              />
            ) : (
              <ListBlock
                mainCount={mainCount}
                extraCount={extraCount}
                deck={deck}
                stats={stats}
                colors={colors}
                styles={styles}
              />
            )}

            {/* CTA Copier (wishlist) + Suivre l'auteur si !isOwner */}
            {!isOwner && (
              <View style={styles.ctaRow}>
                <View style={{ flex: 1 }}>
                  <CyberButton
                    label={wishlisted ? 'Ajouté ✓' : 'Copier ce deck'}
                    variant="primary"
                    block
                    cutColor={colors.bg}
                    loading={wishlistBusy}
                    disabled={wishlisted}
                    onPress={handleWishlistToggle}
                  />
                </View>
                {deck.user_id && deck.user_id !== user?.id && (
                  <View style={{ flex: 1 }}>
                    <CyberButton
                      label={isFollowing ? 'Suivi' : "Suivre l'auteur"}
                      variant="secondary"
                      block
                      cutColor={colors.bg}
                      loading={followBusy}
                      onPress={handleFollowToggle}
                    />
                  </View>
                )}
              </View>
            )}

            {isOwner && (
              <View style={{ marginTop: spacing[3] }}>
                <CyberButton
                  label="Éditer le grimoire"
                  variant="secondary"
                  onPress={() => router.push(`/deck/edit/${deck.id}`)}
                  block
                  cutColor={colors.bg}
                />
              </View>
            )}

            {/* ═══ COMMENTAIRES ═══ */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Commentaires</Text>
              <Text style={styles.sectionCount}>{comments.length}</Text>
              <View style={styles.sectionSep} />
            </View>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Laisser une offrande…"
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!postingComment}
              />
              <CyberButton
                label="Poster"
                variant="primary"
                size="sm"
                onPress={handlePostComment}
                disabled={!commentText.trim()}
                loading={postingComment}
                cutColor={colors.bg}
              />
            </View>

            {comments.length === 0 ? (
              <Text style={styles.noComments}>Aucun commentaire pour l&apos;instant.</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentBox}>
                  <View style={styles.commentAccent} pointerEvents="none" />
                  <View style={styles.commentHeaderRow}>
                    <Text style={styles.commentAuthor}>
                      @{c.user?.username || 'anonyme'}
                    </Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{c.content}</Text>
                  {(user?.id === c.user_id || isOwner) && (
                    <TouchableOpacity onPress={() => handleDeleteComment(c)}>
                      <Text style={styles.commentDelete}>Supprimer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <CornerOrnaments />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Blocs internes — Arena et List
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Bloc Arène — plateau 3D + Cartes clés horizontales + 3 compteurs biseautés.
 * Le plateau perspective 3D est mis en placeholder « — À venir » (React Native n'a
 * pas d'équivalent de `perspective+rotateX+transform-origin` avec le rendu attendu).
 */
function ArenaBlock({
  mainCount,
  extraCount,
  mainDeck,
  colors,
  styles,
}: {
  mainCount: number;
  extraCount: number;
  mainDeck: DeckCard[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <>
      {/* Plateau — placeholder « À venir » avec 5+5 zones stylées */}
      <View style={styles.arenaBoard}>
        <View style={styles.arenaGrid}>
          <View style={styles.arenaGridLines} pointerEvents="none" />

          {/* Back row — 3 Monstres actives + 2 vides */}
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
          {/* Front row — 2 Magies + 1 vide + 1 Piège + 1 vide */}
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

          {/* Extra / Terrain / Cimetière row */}
          <View style={styles.arenaBottomRow}>
            <View style={[styles.arenaTag, { borderColor: colors.rarityRare }]}>
              <Text style={[styles.arenaTagText, { color: colors.cyan }]}>EXTRA</Text>
            </View>
            <View style={[styles.arenaTag, { borderColor: colors.rarityUltra }]}>
              <Text style={[styles.arenaTagText, { color: colors.goldDim }]}>TERRAIN</Text>
            </View>
            <View style={[styles.arenaTag, { borderColor: colors.raritySecret1 }]}>
              <Text style={[styles.arenaTagText, { color: colors.magenta }]}>CIM.</Text>
            </View>
          </View>

          {/* 3 compteurs biseautés Main / Extra / Side */}
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
              <Text style={styles.arenaCounterLabel}>Side</Text>
              <Text style={[styles.arenaCounterVal, { color: colors.cyan }]}>—</Text>
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
      {mainDeck.length === 0 ? (
        <Text style={styles.emptyDeck}>Deck principal vide.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
          {mainDeck.slice(0, 8).map((dc) => (
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
                    style={{ width: '55%', height: '55%', tintColor: '#F5C518', opacity: 0.3 }}
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
    </>
  );
}

/**
 * Bloc Liste — jauge répartition + sections rows.
 * La jauge de répartition Monstres/Magies/Pièges est en « — À venir » : le modèle
 * DeckCard n'expose pas encore le type agrégé côté client.
 */
function ListBlock({
  mainCount,
  extraCount,
  deck,
  stats,
  colors,
  styles,
}: {
  mainCount: number;
  extraCount: number;
  deck: Deck;
  stats: DeckStats | null;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
}) {
  const sections = [
    { title: 'Deck principal', count: mainCount, rows: deck.main_deck || [], accent: colors.gold },
    { title: 'Extra', count: extraCount, rows: deck.extra_deck || [], accent: colors.violet },
  ];

  return (
    <>
      {/* Jauge répartition biseautée */}
      <View style={styles.repartitionBox}>
        <View style={styles.repartitionHeader}>
          <Text style={styles.repartitionLabel}>Répartition</Text>
          <Text style={styles.repartitionValue}>{mainCount} / 40</Text>
        </View>
        <View style={styles.repartitionBar}>
          <View
            style={[styles.repartitionSeg, { flex: stats?.main_by_type.monster ?? 22, backgroundColor: colors.gold }]}
          />
          <View
            style={[styles.repartitionSeg, { flex: stats?.main_by_type.spell ?? 12, backgroundColor: colors.violet }]}
          />
          <View
            style={[styles.repartitionSeg, { flex: stats?.main_by_type.trap ?? 6, backgroundColor: colors.cyan }]}
          />
        </View>
        <View style={styles.repartitionLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.gold }]} />
            <Text style={styles.legendText}>Monstres {stats ? stats.main_by_type.monster : '—'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.violet }]} />
            <Text style={styles.legendText}>Magies {stats ? stats.main_by_type.spell : '—'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.cyan }]} />
            <Text style={styles.legendText}>Pièges {stats ? stats.main_by_type.trap : '—'}</Text>
          </View>
        </View>
      </View>

      {/* Sections avec rows biseautés (PhoneFrame l.292-311) */}
      {sections.map((sec) => (
        <View key={sec.title} style={{ marginTop: 20 }}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <Text style={styles.sectionCount}>{sec.count}</Text>
            <View style={styles.sectionSep} />
          </View>
          <View style={{ marginTop: 10, gap: 6 }}>
            {sec.rows.length === 0 ? (
              <Text style={styles.emptyDeck}>—</Text>
            ) : (
              sec.rows.map((row) => (
                <View
                  key={row.id}
                  style={[styles.deckRow, { borderLeftColor: sec.accent }]}>
                  <View style={styles.deckRowThumb}>
                    {row.card?.card_images?.[0]?.image_url_small ? (
                      <Image
                        source={{ uri: row.card.card_images[0].image_url_small }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.deckRowName} numberOfLines={1}>
                      {row.card?.name || `Carte #${row.card_id}`}
                    </Text>
                    <Text style={styles.deckRowMeta} numberOfLines={1}>
                      {row.card?.type || '—'}
                    </Text>
                  </View>
                  <Text style={styles.deckRowQty}>×{row.quantity}</Text>
                </View>
              ))
            )}
          </View>
        </View>
      ))}
    </>
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

    // ─── Header du deck ─────────────────────────────
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
    actionsCol: {
      gap: 6,
      alignItems: 'flex-end',
    },
    likeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    likeText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      color: t.colors.textMuted,
    },
    commentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },

    // ─── Toggle vue ─────────────────────────────────
    viewToggleRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 4,
    },
    viewToggle: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.06)',
    },
    viewToggleText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.text,
    },

    // ─── Plateau arène ──────────────────────────────
    arenaBoard: {
      marginTop: 18,
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      position: 'relative',
      overflow: 'hidden',
    },
    arenaGrid: {
      gap: 9,
    },
    arenaGridLines: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'transparent',
    },
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
    arenaBottomRow: {
      marginTop: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    arenaTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderStyle: 'dashed',
    },
    arenaTagText: {
      fontFamily: 'sans-serif',
      fontSize: 7,
      letterSpacing: 0.8,
      fontWeight: '700',
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

    // ─── Cartes clés (arena) ────────────────────────
    keyCardWrap: {
      width: 88,
    },
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

    // ─── Jauge répartition (list) ───────────────────
    repartitionBox: {
      marginTop: 16,
      padding: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    repartitionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    repartitionLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1.6,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    repartitionValue: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      color: t.colors.gold,
      fontWeight: '700',
    },
    repartitionBar: {
      marginTop: 8,
      height: 8,
      flexDirection: 'row',
      gap: 2,
    },
    repartitionSeg: {
      opacity: 0.9,
    },
    repartitionLegend: {
      marginTop: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8 },
    legendText: { fontSize: 11, color: t.colors.textMuted },

    // ─── Rows (list) ────────────────────────────────
    deckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 2,
    },
    deckRowThumb: {
      width: 24,
      height: 34,
      backgroundColor: t.colors.panel2,
      overflow: 'hidden',
    },
    deckRowName: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '600',
      color: t.colors.text,
    },
    deckRowMeta: {
      fontSize: 10,
      color: t.colors.textMuted,
      marginTop: 2,
    },
    deckRowQty: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      color: t.colors.gold,
    },

    // ─── Sections + CTA + comments ──────────────────
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
    sectionCount: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      color: t.colors.textMuted,
      fontWeight: '700',
    },
    sectionSep: { flex: 1, height: 1, backgroundColor: t.colors.border },
    ctaRow: { marginTop: 18, flexDirection: 'row', gap: 10 },
    emptyDeck: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      padding: 12,
    },
    commentInputRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-end',
    },
    commentInput: {
      flex: 1,
      backgroundColor: t.colors.panel,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.violet,
      color: t.colors.text,
      minHeight: 40,
      maxHeight: 100,
    },
    noComments: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: 12,
    },
    commentBox: {
      padding: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 4,
      position: 'relative',
      overflow: 'hidden',
      marginTop: spacing[2],
    },
    commentAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: t.colors.violet,
      opacity: 0.7,
    },
    commentHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    commentAuthor: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      letterSpacing: 0.6,
      color: t.colors.violet,
      fontWeight: '700',
    },
    commentDate: {
      fontSize: 11,
      color: t.colors.textMuted,
      fontStyle: 'italic',
    },
    commentText: { fontSize: 14, color: t.colors.text, lineHeight: 20 },
    commentDelete: {
      fontSize: 11,
      color: t.colors.danger,
      marginTop: 4,
      fontWeight: '600',
    },
  });
