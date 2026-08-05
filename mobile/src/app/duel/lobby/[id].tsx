import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { AppBackground } from '@/components/decor/AppBackground';
import { duelApi } from '@/services/duelApi';
import { deckApi } from '@/services/deckApi';
import { API_URL } from '@/config';
import type { Deck, Duel } from '@/types';

/**
 * `/duel/lobby/[id]` — miroir mobile de la salle d'attente web.
 *
 * Layout portrait : mon avatar + deck + Prêt en HAUT, VS, adversaire miroir en
 * BAS. Bouton "Changer de deck" ouvre un modal picker. Poll 3 s + tentative de
 * refetch immédiat au retour d'action ; quand les deux joueurs sont Prêt, on
 * navigue automatiquement vers `/duel/[id]`.
 *
 * Le mobile n'a pas socket.io — on s'appuie sur le poll (comme le reste des
 * écrans temps réel) pour détecter les changements.
 */
export default function DuelLobbyScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const navigatedRef = useRef(false);

  const goDuel = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace(`/duel/${duelId}` as any);
  }, [router, duelId]);

  const fetchDuel = useCallback(async () => {
    try {
      const d = await duelApi.get(duelId);
      setDuel(d);
      // Sortie du lobby : le pile ou face a démarré OU le duel est clos.
      if (d.phase_pre_game || d.status === 'finished' || d.status === 'cancelled') {
        goDuel();
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Duel introuvable');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [duelId, router, goDuel]);

  const fetchDecks = useCallback(async () => {
    try {
      const list = await deckApi.listMine();
      setDecks(list);
    } catch {
      setDecks([]);
    }
  }, []);

  useEffect(() => {
    if (!Number.isInteger(duelId)) return;
    fetchDuel();
    fetchDecks();
  }, [duelId, fetchDuel, fetchDecks]);

  // Poll 3 s (pas de socket.io côté mobile — cf. duelApi commentaire).
  useEffect(() => {
    if (!Number.isInteger(duelId)) return;
    const iv = setInterval(fetchDuel, 3000);
    return () => clearInterval(iv);
  }, [duelId, fetchDuel]);

  const meIsChallenger = duel && user ? duel.challenger_id === user.id : false;
  const meDeckId = duel ? (meIsChallenger ? duel.challenger_deck_id : duel.opponent_deck_id) : null;
  const foeDeckId = duel ? (meIsChallenger ? duel.opponent_deck_id : duel.challenger_deck_id) : null;
  const meReady = duel ? (meIsChallenger ? !!duel.challenger_ready : !!duel.opponent_ready) : false;
  const foeReady = duel ? (meIsChallenger ? !!duel.opponent_ready : !!duel.challenger_ready) : false;
  const meUser = duel ? (meIsChallenger ? duel.challenger : duel.opponent) : null;
  const foeUser = duel ? (meIsChallenger ? duel.opponent : duel.challenger) : null;

  const meDeck = useMemo(() => decks.find((d) => d.id === meDeckId) ?? null, [decks, meDeckId]);

  const bothReady = meReady && foeReady;
  useEffect(() => {
    if (bothReady) goDuel();
  }, [bothReady, goDuel]);

  const handleChangeDeck = async (deckId: number) => {
    if (!duel || busy) return;
    setBusy(true);
    try {
      const updated = await duelApi.changeDeck(duel.id, deckId);
      setDuel(updated);
      setPickerOpen(false);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de changer de deck');
    } finally {
      setBusy(false);
    }
  };

  const handleReady = async () => {
    if (!duel || busy) return;
    setBusy(true);
    try {
      const res = await duelApi.setReady(duel.id);
      setDuel(res.duel);
      if (res.bothReady) goDuel();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de vous déclarer prêt');
    } finally {
      setBusy(false);
    }
  };

  const avatarUri = (pp?: string | null) => {
    if (!pp) return null;
    if (/^https?:\/\//.test(pp)) return pp;
    return `${String(API_URL || '').replace(/\/api\/?$/, '')}${pp}`;
  };

  const renderSide = (opts: {
    isMe: boolean;
    ready: boolean;
    username: string;
    photo?: string | null;
    deckLabel: string;
    accent: string;
  }) => {
    const uri = avatarUri(opts.photo);
    const initials = (opts.username || '?').slice(0, 2).toUpperCase();
    return (
      <View
        style={[
          styles.sideCard,
          { borderColor: opts.ready ? colors.success : opts.accent, borderLeftColor: opts.accent },
        ]}>
        <View style={styles.sideTop}>
          <View style={[styles.avatar, { borderColor: opts.accent }]}>
            {uri ? (
              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>@{opts.username}</Text>
            <Text style={styles.role}>
              {opts.isMe ? 'Toi' : 'Adversaire'}
            </Text>
          </View>
          {opts.ready && (
            <View style={[styles.readyBadge, { borderColor: colors.success }]}>
              <Text style={[styles.readyBadgeText, { color: colors.success }]}>● Pret</Text>
            </View>
          )}
        </View>

        <View style={styles.deckRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deckLabel}>Deck</Text>
            <Text style={styles.deckName} numberOfLines={1}>
              {opts.deckLabel}
            </Text>
          </View>
          {opts.isMe && (
            <TouchableOpacity
              onPress={() => setPickerOpen(true)}
              disabled={meReady || busy}
              style={[
                styles.changeBtn,
                (meReady || busy) && { opacity: 0.4 },
              ]}>
              <Text style={styles.changeBtnText}>
                {meReady ? 'Verrouille' : 'Changer'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!duel) return null;

  const meDeckLabel = meDeck?.name ?? (meDeckId ? `Deck #${meDeckId}` : '—');
  const foeDeckLabel = foeDeckId ? 'Selectionne' : 'Choix en cours…';
  const canReady = !meReady && !!meDeckId;

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Salle d'attente</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>— Avant le pile ou face —</Text>
          <Text style={styles.title}>Duel #{duel.id}</Text>
          <Text style={styles.subtitle}>
            Verifie ton deck puis clique « Pret ». Le pile ou face demarre des que les deux
            joueurs ont confirme.
          </Text>

          {/* MOI en haut */}
          {renderSide({
            isMe: true,
            ready: meReady,
            username: meUser?.username || 'moi',
            photo: meUser?.profile_picture,
            deckLabel: meDeckLabel,
            accent: colors.gold,
          })}

          {/* VS */}
          <View style={styles.vsWrap}>
            <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.vsText, { color: colors.gold }]}>VS</Text>
            <View style={[styles.vsLine, { backgroundColor: colors.border }]} />
          </View>

          {/* ADVERSAIRE en bas */}
          {renderSide({
            isMe: false,
            ready: foeReady,
            username: foeUser?.username || '?',
            photo: foeUser?.profile_picture,
            deckLabel: foeDeckLabel,
            accent: colors.magenta,
          })}

          {/* Bouton Prêt */}
          <TouchableOpacity
            onPress={handleReady}
            disabled={!canReady || busy}
            style={[
              styles.readyCta,
              {
                backgroundColor: canReady ? colors.gold : colors.panel2,
                opacity: canReady && !busy ? 1 : 0.55,
              },
            ]}>
            {busy ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <Text style={[styles.readyCtaText, { color: canReady ? colors.onGold : colors.textMuted }]}>
                {meReady
                  ? foeReady
                    ? 'Lancement…'
                    : "En attente de l'adversaire"
                  : 'Je suis pret'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            {meReady && foeReady && 'Les deux joueurs sont prets — direction le pile ou face.'}
            {meReady && !foeReady && "Tu es pret. L'adversaire choisit encore."}
            {!meReady && foeReady && "L'adversaire est pret. A toi de confirmer."}
            {!meReady && !foeReady && "Aucun joueur n'est encore pret."}
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* Picker deck */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setPickerOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.pickerPanel}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisis ton deck</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} disabled={busy}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {decks.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={styles.hint}>Aucun deck disponible.</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
                {decks.map((d) => {
                  const active = d.id === meDeckId;
                  const mc = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  const ec = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => handleChangeDeck(d.id)}
                      disabled={busy || active}
                      style={[
                        styles.pickerRow,
                        active && { borderColor: colors.gold, backgroundColor: 'rgba(245,197,24,0.10)' },
                      ]}>
                      <Text
                        style={[
                          styles.pickerRowName,
                          active && { color: colors.gold },
                        ]}
                        numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={styles.pickerRowMeta}>
                        {mc} main · {ec} extra
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
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
      fontSize: 13,
      fontWeight: '900',
      color: t.colors.text,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    body: { padding: 18, paddingBottom: 40, gap: 12 },

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
      fontSize: 22,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 12,
      color: t.colors.textMuted,
      lineHeight: 17,
    },

    sideCard: {
      marginTop: 12,
      padding: 14,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderLeftWidth: 3,
    },
    sideTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderWidth: 1,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: t.colors.panel2,
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '900',
      color: t.colors.text,
    },
    username: {
      fontSize: 14,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.6,
    },
    role: {
      marginTop: 2,
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    readyBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
    },
    readyBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },

    deckRow: {
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    deckLabel: {
      fontSize: 9,
      letterSpacing: 1.6,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    deckName: {
      marginTop: 3,
      fontSize: 13,
      fontWeight: '700',
      color: t.colors.text,
    },
    changeBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.08)',
    },
    changeBtnText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },

    vsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginVertical: 8,
    },
    vsLine: { flex: 1, height: 1 },
    vsText: {
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 3,
    },

    readyCta: {
      marginTop: 20,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    readyCtaText: {
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    hint: {
      marginTop: 10,
      fontSize: 11,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },

    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    pickerPanel: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.gold,
    },
    pickerHeader: {
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    pickerTitle: {
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    pickerClose: {
      fontSize: 20,
      color: t.colors.textMuted,
      paddingHorizontal: 8,
    },
    pickerRow: {
      padding: 12,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 4,
    },
    pickerRowName: {
      fontSize: 12,
      fontWeight: '700',
      color: t.colors.text,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pickerRowMeta: {
      fontSize: 11,
      color: t.colors.textMuted,
    },
  });
