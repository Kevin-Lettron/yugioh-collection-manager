import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { AppBackground } from '@/components/decor/AppBackground';
import { AppHeader } from '@/components/decor/AppHeader';
import CyberButton from '@/components/CyberButton';
import { duelApi } from '@/services/duelApi';
import { deckApi } from '@/services/deckApi';
import type { Duel, DuelStatus, Deck } from '@/types';

type ChipStatus = DuelStatus;

const STATUS_ORDER: ChipStatus[] = ['pending', 'active', 'finished'];
const STATUS_LABEL: Record<ChipStatus, string> = {
  pending: 'En attente',
  pre_game: 'Pile ou face',
  active: 'En cours',
  finished: 'Termines',
  cancelled: 'Annules',
};

/**
 * Ecran Duels — pendant mobile du hub `/duels` du web.
 * Liste des defis en cours de l'user avec 3 filtres et actions contextuelles
 * (accepter / refuser / annuler / reprendre / revoir). Le fetch est refait
 * a chaque focus + pull-to-refresh.
 */
export default function DuelsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [duels, setDuels] = useState<Duel[]>([]);
  const [filter, setFilter] = useState<ChipStatus>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Acceptation d'un duel : on stocke le duel a accepter + on demande a l'user
  // de choisir un deck (via une deuxieme modal de type liste de decks).
  const [acceptTarget, setAcceptTarget] = useState<Duel | null>(null);
  const [deckPicker, setDeckPicker] = useState<{ open: boolean; decks: Deck[]; loading: boolean }>(
    { open: false, decks: [], loading: false }
  );

  const fetchAll = useCallback(async () => {
    try {
      const list = await duelApi.listMine();
      setDuels(list);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de charger les duels');
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

  const filtered = useMemo(
    () => duels.filter((d) => d.status === filter),
    [duels, filter]
  );

  const openDeckPickerFor = async (duel: Duel) => {
    setAcceptTarget(duel);
    setDeckPicker({ open: true, decks: [], loading: true });
    try {
      const decks = await deckApi.listMine();
      setDeckPicker({ open: true, decks, loading: false });
    } catch (err: any) {
      setDeckPicker({ open: false, decks: [], loading: false });
      setAcceptTarget(null);
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de charger tes decks');
    }
  };

  const doAccept = async (deckId: number) => {
    if (!acceptTarget) return;
    const duelId = acceptTarget.id;
    setDeckPicker({ open: false, decks: [], loading: false });
    setAcceptTarget(null);
    try {
      await duelApi.accept(duelId, deckId);
      await fetchAll();
      // Salle d'attente d'abord — chaque joueur valide deck + prêt avant que
      // le pile ou face ne démarre.
      router.push(`/duel/lobby/${duelId}` as any);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || "Acceptation echouee");
    }
  };

  const doReject = (duel: Duel) => {
    Alert.alert(
      'Refuser le defi ?',
      `Le duel avec @${duel.challenger?.username || 'anonyme'} sera supprime.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Refuser',
          style: 'destructive',
          onPress: async () => {
            try {
              await duelApi.reject(duel.id);
              await fetchAll();
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error || 'Action echouee');
            }
          },
        },
      ]
    );
  };

  const doCancel = (duel: Duel) => {
    Alert.alert('Annuler le defi ?', '', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler le defi',
        style: 'destructive',
        onPress: async () => {
          try {
            await duelApi.cancel(duel.id);
            await fetchAll();
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.error || 'Action echouee');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <SafeAreaView style={styles.container} edges={['top']}>
          <AppHeader />
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
        <AppHeader />

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
          }
        >
          {/* Titre + kicker */}
          <Text style={styles.kicker}>— Arene —</Text>
          <Text style={styles.title}>
            Du<Text style={{ color: colors.gold }}>els</Text>
          </Text>
          <Text style={styles.subtitle}>
            Retrouve tes defis, accepte, refuse ou reprends une partie en cours.
          </Text>

          {/* Chips filtre */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {STATUS_ORDER.map((s) => {
              const isActive = filter === s;
              const count = duels.filter((d) => d.status === s).length;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setFilter(s)}
                  activeOpacity={0.85}
                  style={[
                    styles.chip,
                    isActive && {
                      borderColor: colors.gold,
                      backgroundColor: 'rgba(245,197,24,0.10)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isActive && { color: colors.gold },
                    ]}
                  >
                    {STATUS_LABEL[s]}
                  </Text>
                  <View
                    style={[
                      styles.chipDot,
                      { backgroundColor: isActive ? colors.gold : colors.textMuted },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipDotText,
                        { color: isActive ? colors.onGold : colors.bg },
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Liste des duels */}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {filter === 'pending'
                  ? 'Aucun defi en attente. Va sur un profil pour lancer un duel.'
                  : filter === 'active'
                    ? 'Aucun duel en cours.'
                    : 'Aucun duel termine.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12, marginTop: 16 }}>
              {filtered.map((d) => (
                <DuelCard
                  key={d.id}
                  duel={d}
                  meId={user?.id ?? -1}
                  onOpen={() => {
                    // Si le duel est active mais pas encore en pile ou face,
                    // on repasse par la salle d'attente.
                    const target =
                      d.status === 'active' && !d.phase_pre_game && !d.first_player_id
                        ? `/duel/lobby/${d.id}`
                        : `/duel/${d.id}`;
                    router.push(target as any);
                  }}
                  onAccept={() => openDeckPickerFor(d)}
                  onReject={() => doReject(d)}
                  onCancel={() => doCancel(d)}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal picker deck pour accepter — on reutilise pas ChallengeModal
          (qui gere le POST /duels), on fait un mini-picker inline. */}
      {deckPicker.open && (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.pickerPanel}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choisis ton deck</Text>
              <TouchableOpacity
                onPress={() => {
                  setDeckPicker({ open: false, decks: [], loading: false });
                  setAcceptTarget(null);
                }}
              >
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {deckPicker.loading ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : deckPicker.decks.length === 0 ? (
              <Text style={styles.emptyText}>Aucun deck disponible.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
                {deckPicker.decks.map((d) => {
                  const mc = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => doAccept(d.id)}
                      activeOpacity={0.85}
                      style={styles.pickerRow}
                    >
                      <Text style={styles.pickerRowName} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={styles.pickerRowMeta}>{mc} cartes</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── DuelCard sub-component ─────────────────────────────────────────────────

interface DuelCardProps {
  duel: Duel;
  meId: number;
  onOpen: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function DuelCard({
  duel,
  meId,
  onOpen,
  onAccept,
  onReject,
  onCancel,
  styles,
  colors,
}: DuelCardProps) {
  const iAmChallenger = duel.challenger_id === meId;
  const me = iAmChallenger ? duel.challenger : duel.opponent;
  const foe = iAmChallenger ? duel.opponent : duel.challenger;
  const meName = me?.username || (iAmChallenger ? 'toi' : 'moi');
  const foeName = foe?.username || 'adversaire';

  const badge = (() => {
    switch (duel.status) {
      case 'pending':
        return { label: iAmChallenger ? 'Envoye' : 'A accepter', color: colors.violet };
      case 'active':
        return { label: 'En cours', color: colors.success };
      case 'finished':
        return { label: duel.winner_id === meId ? 'Victoire' : 'Defaite', color: duel.winner_id === meId ? colors.gold : colors.magenta };
      case 'cancelled':
        return { label: 'Annule', color: colors.textMuted };
      default:
        return { label: duel.status, color: colors.textMuted };
    }
  })();

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={duel.status === 'active' || duel.status === 'finished' ? 0.85 : 1}
      style={styles.duelCard}
    >
      {/* Ligne avatars + VS */}
      <View style={styles.duelRow}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { borderColor: colors.violet }]}>
            <Text style={styles.avatarText}>{meName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.avatarName} numberOfLines={1}>
            @{meName}
          </Text>
        </View>

        <View style={styles.vsWrap}>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.vsSeparator} />
          <View style={[styles.statusBadge, { borderColor: badge.color }]}>
            <Text style={[styles.statusBadgeText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { borderColor: colors.magenta }]}>
            <Text style={styles.avatarText}>{foeName.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.avatarName} numberOfLines={1}>
            @{foeName}
          </Text>
        </View>
      </View>

      {/* Meta ligne 2 */}
      <View style={styles.duelMeta}>
        <Text style={styles.duelMetaText}>
          Duel #{duel.id} · Tour {duel.turn_number}
        </Text>
        <Text style={styles.duelMetaText}>
          LP {duel.challenger_lp} / {duel.opponent_lp}
        </Text>
      </View>

      {/* Actions contextuelles */}
      <View style={styles.actionsRow}>
        {duel.status === 'pending' && !iAmChallenger && (
          <>
            <View style={{ flex: 1 }}>
              <CyberButton
                label="Accepter"
                variant="primary"
                block
                size="sm"
                cutColor={colors.panel}
                onPress={onAccept}
              />
            </View>
            <View style={{ flex: 1 }}>
              <CyberButton
                label="Refuser"
                variant="danger"
                block
                size="sm"
                cutColor={colors.panel}
                onPress={onReject}
              />
            </View>
          </>
        )}
        {duel.status === 'pending' && iAmChallenger && (
          <View style={{ flex: 1 }}>
            <CyberButton
              label="Annuler le defi"
              variant="danger"
              block
              size="sm"
              cutColor={colors.panel}
              onPress={onCancel}
            />
          </View>
        )}
        {duel.status === 'active' && (
          <View style={{ flex: 1 }}>
            <CyberButton
              label="Reprendre"
              variant="primary"
              block
              size="sm"
              cutColor={colors.panel}
              onPress={onOpen}
            />
          </View>
        )}
        {duel.status === 'finished' && (
          <View style={{ flex: 1 }}>
            <CyberButton
              label="Revoir le duel"
              variant="secondary"
              block
              size="sm"
              cutColor={colors.panel}
              onPress={onOpen}
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    body: { padding: 18, paddingBottom: 96, gap: 6 },

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
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 12,
      color: t.colors.textMuted,
      lineHeight: 17,
    },

    chipsRow: {
      marginTop: 18,
      flexDirection: 'row',
      gap: 8,
      paddingRight: 20,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    chipText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
    },
    chipDot: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipDotText: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      fontWeight: '900',
    },

    empty: {
      marginTop: 40,
      padding: 24,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },

    // ─── DuelCard ─────────────────────────────────────
    duelCard: {
      padding: 14,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.gold,
      gap: 12,
    },
    duelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarWrap: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    avatar: {
      width: 46,
      height: 46,
      borderWidth: 1,
      backgroundColor: t.colors.panel2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: '900',
      color: t.colors.text,
    },
    avatarName: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
    },
    vsWrap: {
      alignItems: 'center',
      gap: 6,
      minWidth: 82,
    },
    vsText: {
      fontFamily: 'sans-serif',
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 2,
      color: t.colors.gold,
    },
    vsSeparator: { width: 32, height: 1, backgroundColor: t.colors.border },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    statusBadgeText: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    duelMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    duelMetaText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 0.8,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },

    // ─── Deck picker (inline modal) ───────────────────
    overlay: {
      ...StyleSheet.absoluteFillObject,
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
      fontFamily: 'sans-serif',
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
      fontFamily: 'sans-serif',
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
