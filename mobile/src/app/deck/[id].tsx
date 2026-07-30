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

export default function DeckViewScreen() {
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
        <ActivityIndicator size="large" color="#7c3aed" />
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
              {deck.is_public && <Badge label="Public" color="#d1fae5" />}
              {deck.is_shared && <Badge label="Partagé" color="#fef3c7" />}
              {deck.respect_banlist && <Badge label="Banlist" color="#ede9fe" />}
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
            <TouchableOpacity
              style={[styles.reactBtn, deck.user_reaction === 'like' && styles.reactBtnLikeActive]}
              onPress={() => handleReaction('like')}
              disabled={reacting}>
              <Text
                style={[styles.reactBtnText, deck.user_reaction === 'like' && styles.reactBtnTextActive]}>
                👍 J'aime
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reactBtn, deck.user_reaction === 'dislike' && styles.reactBtnDislikeActive]}
              onPress={() => handleReaction('dislike')}
              disabled={reacting}>
              <Text
                style={[styles.reactBtnText, deck.user_reaction === 'dislike' && styles.reactBtnTextActive]}>
                👎 J'aime pas
              </Text>
            </TouchableOpacity>
          </View>

          {/* Owner actions */}
          {isOwner && (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/deck/edit/${deck.id}`)}>
              <Text style={styles.editBtnText}>✏️ Éditer le deck</Text>
            </TouchableOpacity>
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
              placeholderTextColor="#9ca3af"
              multiline
              editable={!postingComment}
            />
            <TouchableOpacity
              style={[
                styles.commentPostBtn,
                (!commentText.trim() || postingComment) && { opacity: 0.5 },
              ]}
              onPress={handlePostComment}
              disabled={!commentText.trim() || postingComment}>
              {postingComment ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.commentPostBtnText}>Poster</Text>
              )}
            </TouchableOpacity>
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

const Badge = ({ label, color }: { label: string; color: string }) => (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

const StatCell = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.statCell}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 24, color: '#374151' },
  body: { padding: 12, gap: 12, paddingBottom: 40 },
  metaBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaAuthor: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  metaBadges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  statsGrid: { flexDirection: 'row', gap: 6 },
  statCell: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  reactionsRow: { flexDirection: 'row', gap: 8 },
  reactBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reactBtnLikeActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  reactBtnDislikeActive: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  reactBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  reactBtnTextActive: { color: '#fff' },
  editBtn: {
    backgroundColor: '#7c3aed',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 8 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cardBox: { width: '23.5%', aspectRatio: 0.686, position: 'relative' },
  cardImage: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#e5e7eb' },
  qtyOverlay: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  qtyOverlayText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  emptyDeck: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  commentInputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
    minHeight: 40,
    maxHeight: 100,
  },
  commentPostBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  commentPostBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noComments: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', padding: 12 },
  commentBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 4,
  },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#111827' },
  commentDate: { fontSize: 11, color: '#9ca3af' },
  commentText: { fontSize: 14, color: '#374151' },
  commentDelete: { fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: '600' },
});
