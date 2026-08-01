import { useCallback, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { deckApi } from '@/services/deckApi';
import type { Deck, DeckComment } from '@/types';
import { API_URL } from '@/config';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { CardTile } from '@/components/decor/CardTile';
import { spacing } from '@/theme/palette';

export default function DeckViewScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [comments, setComments] = useState<DeckComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reacting, setReacting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        deckApi.get(deckId),
        deckApi.listComments(deckId).catch(() => [] as DeckComment[]),
      ]);
      setDeck(d);
      setComments(c);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Deck introuvable');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deckId, router]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const isOwner = deck && user && deck.user_id === user.id;

  const handleReaction = async (type: 'like' | 'dislike') => {
    if (!deck || reacting) return;
    setReacting(true);
    try {
      if (deck.user_reaction === type) {
        await deckApi.clearReaction(deckId);
      } else if (type === 'like') {
        await deckApi.like(deckId);
      } else {
        await deckApi.dislike(deckId);
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
      await Share.share({
        message: `Regarde mon deck "${deck.name}" : ${url}`,
        url,
      });
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

  const mainCount = deck.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const extraCount = deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerCrumb} numberOfLines={1}>
            Arène
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>↗</Text>
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
                onRefresh={() => { setRefreshing(true); fetchAll(); }}
                tintColor={colors.gold}
              />
            }>
            <HeroTitle
              kicker="— Arène ouverte —"
              title={deck.name}
              sub={`par ${isOwner ? 'toi' : deck.user?.username || 'Anonyme'} · ${mainCount} · ${extraCount}`}
            />

            {/* Meta badges */}
            <View style={styles.metaBadges}>
              {deck.is_public && <Badge label="Public" />}
              {deck.is_shared && <Badge label="Partagé" />}
              {deck.respect_banlist && <Badge label="Banlist" />}
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <StatCell label="Main" value={mainCount} />
              <StatCell label="Extra" value={extraCount} />
              <StatCell label="Aimés" value={deck.likes_count ?? 0} />
              <StatCell label="Voix" value={deck.comments_count ?? comments.length} />
            </View>

            {/* Reactions */}
            <View style={styles.reactionsRow}>
              <CyberButton
                label={deck.user_reaction === 'like' ? "J'aime · Oui" : "J'aime"}
                variant={deck.user_reaction === 'like' ? 'primary' : 'ghost'}
                onPress={() => handleReaction('like')}
                disabled={reacting}
                block
                style={{ flex: 1 }}
                cutColor={colors.bg}
              />
              <CyberButton
                label={deck.user_reaction === 'dislike' ? 'Pas fan' : 'Pas fan'}
                variant={deck.user_reaction === 'dislike' ? 'danger' : 'ghost'}
                onPress={() => handleReaction('dislike')}
                disabled={reacting}
                block
                style={{ flex: 1 }}
                cutColor={colors.bg}
              />
            </View>

            {/* Owner actions */}
            {isOwner && (
              <CyberButton
                label="Éditer le deck"
                variant="primary"
                onPress={() => router.push(`/deck/edit/${deck.id}`)}
                block
                cutColor={colors.bg}
              />
            )}

            {/* Main deck */}
            <SectionTitle label="Deck principal" count={mainCount} />
            <View style={styles.cardGrid}>
              {(deck.main_deck || []).map((dc) => (
                <View key={dc.id} style={styles.cardCell}>
                  <CardTile
                    uri={dc.card?.card_images?.[0]?.image_url_small}
                    name={dc.card?.name}
                    quantity={dc.quantity}
                  />
                </View>
              ))}
              {mainCount === 0 && <Text style={styles.emptyDeck}>Deck principal vide.</Text>}
            </View>

            {/* Extra deck */}
            {(deck.extra_deck || []).length > 0 && (
              <>
                <SectionTitle label="Extra deck" count={extraCount} />
                <View style={styles.cardGrid}>
                  {deck.extra_deck!.map((dc) => (
                    <View key={dc.id} style={styles.cardCell}>
                      <CardTile
                        uri={dc.card?.card_images?.[0]?.image_url_small}
                        name={dc.card?.name}
                        quantity={dc.quantity}
                      />
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Comments */}
            <SectionTitle label="Commentaires" count={comments.length} />
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Ajouter un commentaire…"
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
              <Text style={styles.noComments}>Aucun commentaire pour l'instant.</Text>
            ) : (
              comments.map((c) => (
                <View key={c.id} style={styles.commentBox}>
                  <View style={styles.commentAccent} pointerEvents="none" />
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.user?.username || 'Anonyme'}</Text>
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

const Badge = ({ label }: { label: string }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
  );
};

const StatCell = ({ label, value }: { label: string; value: number }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.statCell}>
    <View style={styles.statAccent} pointerEvents="none" />
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
  );
};

const SectionTitle = ({ label, count }: { label: string; count: number }) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
      <View style={styles.sectionSep} />
    </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerCrumb: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.gold,
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 22, color: t.colors.text },
  body: { padding: spacing[3], gap: spacing[3], paddingBottom: spacing[7] },
  metaBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.panel2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statsGrid: { flexDirection: 'row', gap: spacing[2] },
  statCell: {
    flex: 1,
    backgroundColor: t.colors.panel,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: t.colors.gold,
    opacity: 0.6,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: t.colors.text, marginTop: 2 },
  statLabel: {
    fontSize: 9,
    color: t.colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  reactionsRow: { flexDirection: 'row', gap: spacing[2] },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[3],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    color: t.colors.textMuted,
    fontWeight: '700',
  },
  sectionSep: {
    flex: 1,
    height: 1,
    backgroundColor: t.colors.border,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  cardCell: { width: '31%' },
  emptyDeck: {
    fontSize: 13,
    color: t.colors.textMuted,
    fontStyle: 'italic',
    padding: spacing[3],
  },
  commentInputRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-end' },
  commentInput: {
    flex: 1,
    backgroundColor: t.colors.panel,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 2,
    borderLeftColor: t.colors.gold,
    color: t.colors.text,
    minHeight: 40,
    maxHeight: 100,
  },
  noComments: {
    fontSize: 13,
    color: t.colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: spacing[3],
  },
  commentBox: {
    backgroundColor: t.colors.panel,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[1],
    position: 'relative',
    overflow: 'hidden',
  },
  commentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: t.colors.violet,
    opacity: 0.6,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: t.colors.text },
  commentDate: { fontSize: 11, color: t.colors.textMuted, fontStyle: 'italic' },
  commentText: { fontSize: 14, color: t.colors.text },
  commentDelete: { fontSize: 11, color: t.colors.danger, marginTop: spacing[1], fontWeight: '600' },
});
