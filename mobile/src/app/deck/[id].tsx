import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const mainCount = deck.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const extraCount = deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {deck.name}
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
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} />
          }>
          {/* Meta */}
          <View style={styles.metaBar}>
            <Text style={styles.metaAuthor}>
              {isOwner ? 'Toi' : deck.user?.username || 'Anonyme'}
            </Text>
            <View style={styles.metaBadges}>
              {deck.is_public && <Badge label="Public" color={colors.panel2} />}
              {deck.is_shared && <Badge label="Partagé" color={colors.panel2} />}
              {deck.respect_banlist && <Badge label="Banlist" color={colors.panel2} />}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <StatCell label="Main" value={mainCount} />
            <StatCell label="Extra" value={extraCount} />
            <StatCell label="👍" value={deck.likes_count ?? 0} />
            <StatCell label="💬" value={deck.comments_count ?? comments.length} />
          </View>

          {/* Reactions */}
          <View style={styles.reactionsRow}>
            <CyberButton
              label="👍 J'aime"
              variant={deck.user_reaction === 'like' ? 'primary' : 'ghost'}
              onPress={() => handleReaction('like')}
              disabled={reacting}
              block
              style={{ flex: 1 }}
            />
            <CyberButton
              label="👎 J'aime pas"
              variant={deck.user_reaction === 'dislike' ? 'danger' : 'ghost'}
              onPress={() => handleReaction('dislike')}
              disabled={reacting}
              block
              style={{ flex: 1 }}
            />
          </View>

          {/* Owner actions */}
          {isOwner && (
            <CyberButton
              label="Éditer le deck"
              variant="primary"
              onPress={() => router.push(`/deck/edit/${deck.id}`)}
              block
            />
          )}

          {/* Main deck */}
          <Text style={styles.sectionTitle}>Deck principal ({mainCount})</Text>
          <View style={styles.cardGrid}>
            {(deck.main_deck || []).map((dc) => (
              <View key={dc.id} style={styles.cardBox}>
                <Image
                  source={{ uri: dc.card?.card_images?.[0]?.image_url_small }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
                {dc.quantity > 1 && (
                  <View style={styles.qtyOverlay}>
                    <Text style={styles.qtyOverlayText}>x{dc.quantity}</Text>
                  </View>
                )}
              </View>
            ))}
            {mainCount === 0 && <Text style={styles.emptyDeck}>Deck principal vide</Text>}
          </View>

          {/* Extra deck */}
          {(deck.extra_deck || []).length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Extra deck ({extraCount})</Text>
              <View style={styles.cardGrid}>
                {deck.extra_deck!.map((dc) => (
                  <View key={dc.id} style={styles.cardBox}>
                    <Image
                      source={{ uri: dc.card?.card_images?.[0]?.image_url_small }}
                      style={styles.cardImage}
                      resizeMode="cover"
                    />
                    {dc.quantity > 1 && (
                      <View style={styles.qtyOverlay}>
                        <Text style={styles.qtyOverlayText}>x{dc.quantity}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Comments */}
          <Text style={styles.sectionTitle}>Commentaires ({comments.length})</Text>
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
            />
          </View>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>Aucun commentaire pour l'instant.</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentBox}>
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
  );
}

const Badge = ({ label, color }: { label: string; color: string }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
  );
};

const StatCell = ({ label, value }: { label: string; value: number }) => {
  const styles = useThemedStyles(makeStyles);
  return (
  <View style={styles.statCell}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
  );
};

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: t.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: t.colors.text, textAlign: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 24, color: t.colors.text },
  body: { padding: 12, gap: 12, paddingBottom: 40 },
  metaBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaAuthor: { fontSize: 13, color: t.colors.textMuted, fontWeight: '600' },
  metaBadges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700', color: t.colors.text },
  statsGrid: { flexDirection: 'row', gap: 6 },
  statCell: {
    flex: 1,
    backgroundColor: t.colors.panel,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: t.colors.text },
  statLabel: { fontSize: 11, color: t.colors.textMuted, marginTop: 2 },
  reactionsRow: { flexDirection: 'row', gap: 8 },
  reactBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  reactBtnLikeActive: { backgroundColor: t.colors.success, borderColor: t.colors.success },
  reactBtnDislikeActive: { backgroundColor: t.colors.danger, borderColor: t.colors.danger },
  reactBtnText: { fontSize: 13, fontWeight: '600', color: t.colors.text },
  reactBtnTextActive: { color: t.colors.onGold },
  editBtn: {
    backgroundColor: t.colors.gold,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtnText: { color: t.colors.onGold, fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: t.colors.text, marginTop: 8 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cardBox: { width: '23.5%', aspectRatio: 0.686, position: 'relative' },
  cardImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: t.colors.panel2 },
  qtyOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  qtyOverlayText: { color: t.colors.onGold, fontSize: 10, fontWeight: '700' },
  emptyDeck: { fontSize: 13, color: t.colors.textMuted, fontStyle: 'italic' },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  commentInput: {
    flex: 1,
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    color: t.colors.text,
    minHeight: 40,
    maxHeight: 100,
  },
  commentPostBtn: {
    backgroundColor: t.colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  commentPostBtnText: { color: t.colors.onGold, fontSize: 13, fontWeight: '600' },
  noComments: { fontSize: 13, color: t.colors.textMuted, fontStyle: 'italic', textAlign: 'center', padding: 12 },
  commentBox: {
    backgroundColor: t.colors.panel,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 4,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: t.colors.text },
  commentDate: { fontSize: 11, color: t.colors.textMuted },
  commentText: { fontSize: 14, color: t.colors.text },
  commentDelete: { fontSize: 11, color: t.colors.danger, marginTop: 4, fontWeight: '600' },
});
