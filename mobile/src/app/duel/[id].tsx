import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { AppBackground } from '@/components/decor/AppBackground';
import { duelApi } from '@/services/duelApi';
import type {
  BoardCard,
  Duel,
  DuelAction,
  DuelActionType,
  DuelChatMessage,
  DuelPhase,
  PlayerBoardState,
} from '@/types';

type Side = 'me' | 'foe';

const PHASE_LABEL: Record<DuelPhase, string> = {
  draw: 'Pioche',
  main1: 'Main 1',
  battle: 'Combat',
  main2: 'Main 2',
  end: 'Fin',
};

const PHASE_ORDER: DuelPhase[] = ['draw', 'main1', 'battle', 'main2', 'end'];

/**
 * Ecran duel — arene interactive.
 *
 * Miroir mobile portrait du playtester web /duel/:id. Le back gere la logique
 * (voir server/src/controllers/duelController.ts) : ici on n'envoie que des
 * actions typees et on re-render depuis l'etat renvoye.
 *
 * Temps reel : le mobile n'a pas socket.io — on refetch toutes les 2 s tant
 * que le duel est actif. On diffe sur `updated_at` pour eviter les re-renders
 * inutiles quand rien n'a bouge cote back.
 */
export default function DuelScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [duel, setDuel] = useState<Duel | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Selection courante en main : index dans la main du joueur.
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null);
  // Selection courante d'un attaquant : index dans mes monstres (phase battle).
  const [selectedAttackerSlot, setSelectedAttackerSlot] = useState<number | null>(null);
  // Chat modal
  const [chatOpen, setChatOpen] = useState(false);

  const fetchDuel = useCallback(async () => {
    try {
      const d = await duelApi.get(duelId);
      setDuel((prev) => {
        if (!prev) return d;
        if (prev.updated_at === d.updated_at) return prev;
        return d;
      });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Duel introuvable');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [duelId, router]);

  useEffect(() => {
    fetchDuel();
  }, [fetchDuel]);

  // Polling — refetch toutes les 2 s tant que status === active. Stop des que
  // le duel se termine ou que la vue est demontee.
  const pollingActive = duel?.status === 'active';
  const lastUpdatedRef = useRef<string | null>(null);
  useEffect(() => {
    lastUpdatedRef.current = duel?.updated_at ?? null;
  }, [duel?.updated_at]);
  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(async () => {
      try {
        const fresh = await duelApi.get(duelId);
        if (fresh.updated_at !== lastUpdatedRef.current) {
          setDuel(fresh);
        }
      } catch {
        /* transient — on retentera au prochain tick */
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [pollingActive, duelId]);

  // ─── Derivations cote « moi » vs « adversaire » ─────────────────────────
  const meIsChallenger = duel && user ? duel.challenger_id === user.id : false;
  const myState: PlayerBoardState | null = duel
    ? meIsChallenger
      ? duel.challenger_state ?? null
      : duel.opponent_state ?? null
    : null;
  const foeState: PlayerBoardState | null = duel
    ? meIsChallenger
      ? duel.opponent_state ?? null
      : duel.challenger_state ?? null
    : null;
  const myLp = duel ? (meIsChallenger ? duel.challenger_lp : duel.opponent_lp) : 8000;
  const foeLp = duel ? (meIsChallenger ? duel.opponent_lp : duel.challenger_lp) : 8000;
  const myUser = duel ? (meIsChallenger ? duel.challenger : duel.opponent) : null;
  const foeUser = duel ? (meIsChallenger ? duel.opponent : duel.challenger) : null;
  const isMyTurn = duel && user ? duel.current_turn_player_id === user.id : false;
  const currentPhase = duel?.current_phase ?? 'main1';

  // ─── Envoi d'action ─────────────────────────────────────────────────────
  const performAction = useCallback(
    async (type: DuelActionType, payload?: any) => {
      if (!duel || acting) return;
      setActing(true);
      try {
        const updated = await duelApi.performAction(duel.id, {
          type,
          payload: payload ?? {},
        } as DuelAction);
        setDuel(updated);
      } catch (err: any) {
        Alert.alert(
          'Action refusee',
          err?.response?.data?.error || 'Action impossible.'
        );
      } finally {
        setActing(false);
      }
    },
    [duel, acting]
  );

  // ─── Interactions — hand → zone ──────────────────────────────────────────
  const handleHandTap = (idx: number) => {
    if (!isMyTurn || currentPhase === 'battle') return;
    setSelectedAttackerSlot(null);
    setSelectedHandIdx((prev) => (prev === idx ? null : idx));
  };

  const handleEmptyZoneTap = (zone: 'monster' | 'spelltrap' | 'field', slotIndex?: number) => {
    if (selectedHandIdx === null || !myState) return;
    const card = myState.hand[selectedHandIdx];
    if (!card) return;

    const handIdx = selectedHandIdx;

    // Menu de placement — different selon la zone
    const opts: { label: string; onPress: () => void }[] = [];
    if (zone === 'monster') {
      opts.push({
        label: 'Attaque face visible',
        onPress: () => {
          performAction('place', {
            fromHandIndex: handIdx,
            zone,
            slotIndex,
            faceDown: false,
            defenseMode: false,
          });
          setSelectedHandIdx(null);
        },
      });
      opts.push({
        label: 'Defense face visible',
        onPress: () => {
          performAction('place', {
            fromHandIndex: handIdx,
            zone,
            slotIndex,
            faceDown: false,
            defenseMode: true,
          });
          setSelectedHandIdx(null);
        },
      });
      opts.push({
        label: 'Defense face verso (Set)',
        onPress: () => {
          performAction('place', {
            fromHandIndex: handIdx,
            zone,
            slotIndex,
            faceDown: true,
            defenseMode: true,
          });
          setSelectedHandIdx(null);
        },
      });
    } else {
      // spelltrap / field
      opts.push({
        label: 'Face visible',
        onPress: () => {
          performAction('place', {
            fromHandIndex: handIdx,
            zone,
            slotIndex,
            faceDown: false,
          });
          setSelectedHandIdx(null);
        },
      });
      opts.push({
        label: 'Face verso (Set)',
        onPress: () => {
          performAction('place', {
            fromHandIndex: handIdx,
            zone,
            slotIndex,
            faceDown: true,
          });
          setSelectedHandIdx(null);
        },
      });
    }
    opts.push({ label: 'Annuler', onPress: () => {} });

    Alert.alert(
      card.card?.name ?? 'Carte',
      `Poser sur ${zone === 'monster' ? 'Monstre' : zone === 'spelltrap' ? 'Magie/Piege' : 'Terrain'}`,
      opts.map((o) => ({
        text: o.label,
        onPress: o.onPress,
        style: o.label === 'Annuler' ? 'cancel' : 'default',
      })) as any
    );
  };

  const handleMyBoardCardTap = (
    zone: 'monster' | 'spelltrap' | 'field',
    slotIndex: number,
    bc: BoardCard
  ) => {
    // En phase battle, tapper un de mes monstres = selection attaquant
    if (isMyTurn && currentPhase === 'battle' && zone === 'monster') {
      if (bc.faceDown || bc.defenseMode) {
        Alert.alert('Impossible', 'Un monstre en defense ou face verso ne peut pas attaquer.');
        return;
      }
      setSelectedAttackerSlot((prev) => (prev === slotIndex ? null : slotIndex));
      return;
    }
    if (!isMyTurn) return;

    const opts: any[] = [];
    opts.push({
      text: bc.faceDown ? 'Retourner face visible' : 'Retourner face verso',
      onPress: () =>
        performAction('flip', { zone, slotIndex, defenseMode: bc.defenseMode }),
    });
    if (zone === 'monster') {
      opts.push({
        text: bc.defenseMode ? 'Passer en attaque' : 'Passer en defense',
        onPress: () =>
          performAction('flip', {
            zone,
            slotIndex,
            defenseMode: !bc.defenseMode,
          }),
      });
    }
    opts.push({
      text: 'Envoyer au cimetiere',
      style: 'destructive',
      onPress: () => performAction('sendToGraveyard', { zone, slotIndex }),
    });
    opts.push({
      text: 'Bannir',
      style: 'destructive',
      onPress: () => performAction('banish', { zone, slotIndex }),
    });
    opts.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(bc.card.card?.name ?? 'Carte', '', opts);
  };

  const handleFoeZoneTapForAttack = (targetSlot: number | null) => {
    if (
      selectedAttackerSlot === null ||
      currentPhase !== 'battle' ||
      !isMyTurn ||
      !myState ||
      !foeState
    ) {
      return;
    }
    const foeHasMonsters = foeState.monsters.some((m) => m !== null);
    if (targetSlot === null && foeHasMonsters) {
      Alert.alert('Impossible', 'Attaque directe interdite si l\'adversaire a des monstres.');
      return;
    }
    performAction('attack', {
      attackerSlot: selectedAttackerSlot,
      targetSlot,
    });
    setSelectedAttackerSlot(null);
  };

  const handleAdvancePhase = () => {
    if (!isMyTurn || !duel) return;
    performAction('advance_phase');
  };
  const handleEndTurn = () => {
    if (!isMyTurn || !duel) return;
    Alert.alert('Terminer le tour ?', 'Ton adversaire piochera automatiquement.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        onPress: () => {
          setSelectedHandIdx(null);
          setSelectedAttackerSlot(null);
          performAction('end_turn');
        },
      },
    ]);
  };

  const handleSurrender = () => {
    if (!duel) return;
    Alert.alert('Abandonner ?', 'Tu perds immediatement le duel.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: () => performAction('surrender'),
      },
    ]);
  };

  const handleSendChat = async (message: string) => {
    if (!message.trim() || !duel) return;
    await performAction('chat', { message });
  };

  // ─── Rendu ───────────────────────────────────────────────────────────────
  if (loading || !duel || !myState || !foeState) {
    return (
      <View style={styles.root}>
        <AppBackground />
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.gold} />
          ) : (
            <Text style={styles.emptyText}>
              Ce duel n&apos;a pas encore de plateau initialise.
            </Text>
          )}
        </View>
      </View>
    );
  }

  const finished = duel.status === 'finished';
  const iWon = finished && duel.winner_id === user?.id;

  const nextPhaseLabel = (() => {
    const idx = PHASE_ORDER.indexOf(currentPhase);
    const next = PHASE_ORDER[idx + 1];
    if (!next) return null;
    return `${PHASE_LABEL[currentPhase]} → ${PHASE_LABEL[next]}`;
  })();

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header : back + noms + phase + abandonner */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              @{myUser?.username || 'moi'} vs @{foeUser?.username || 'adversaire'}
            </Text>
            <Text style={styles.headerSub}>
              Tour {duel.turn_number} · {PHASE_LABEL[currentPhase]}
              {isMyTurn ? ' · ton tour' : ' · tour adverse'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSurrender}
            style={[styles.chromeBtn, { paddingHorizontal: 6 }]}
          >
            <Text style={[styles.chromeBtnText, { color: colors.danger, fontSize: 14 }]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Adversaire — plateau haut */}
          <PlayerBoard
            side="foe"
            state={foeState}
            user={foeUser}
            lp={foeLp}
            isMyTurn={!isMyTurn}
            selectedAttackerSlot={null}
            onEmptyZoneTap={() => {}}
            onCardTap={(zone, slot, bc) => {
              // Attaque : tap sur monstre adverse comme cible
              if (
                zone === 'monster' &&
                selectedAttackerSlot !== null &&
                currentPhase === 'battle' &&
                isMyTurn
              ) {
                handleFoeZoneTapForAttack(slot);
                return;
              }
              // Sinon on affiche juste le nom (lecture seule)
              const name = bc.card.card?.name ?? 'Carte adverse';
              Alert.alert(
                bc.faceDown ? 'Carte face verso' : name,
                bc.faceDown ? 'Face verso — carte cachee.' : ''
              );
            }}
            onFoeEmptyMonsterRowAttack={
              selectedAttackerSlot !== null && currentPhase === 'battle' && isMyTurn
                ? () => handleFoeZoneTapForAttack(null)
                : undefined
            }
            styles={styles}
            colors={colors}
          />

          {/* Bande centrale — indicateur tour */}
          <View style={styles.turnBand}>
            <View
              style={[
                styles.turnBadge,
                {
                  borderColor: isMyTurn ? colors.gold : colors.violet,
                  backgroundColor: isMyTurn
                    ? 'rgba(245,197,24,0.10)'
                    : 'rgba(168,85,247,0.10)',
                },
              ]}
            >
              <Text
                style={[
                  styles.turnBadgeText,
                  { color: isMyTurn ? colors.gold : colors.violet },
                ]}
              >
                {isMyTurn ? 'TON TOUR' : 'TOUR ADVERSE'}
              </Text>
            </View>
            <Text style={styles.turnPhase}>{PHASE_LABEL[currentPhase]}</Text>
          </View>

          {/* Moi — plateau bas (interactif) */}
          <PlayerBoard
            side="me"
            state={myState}
            user={myUser}
            lp={myLp}
            isMyTurn={isMyTurn}
            selectedAttackerSlot={selectedAttackerSlot}
            onEmptyZoneTap={handleEmptyZoneTap}
            onCardTap={handleMyBoardCardTap}
            styles={styles}
            colors={colors}
          />

          {/* Boutons phase */}
          {duel.status === 'active' && isMyTurn && (
            <View style={styles.phaseRow}>
              {nextPhaseLabel && (
                <TouchableOpacity
                  onPress={handleAdvancePhase}
                  style={[styles.phaseBtn, { borderColor: colors.gold }]}
                  disabled={acting}
                >
                  <Text style={[styles.phaseBtnText, { color: colors.gold }]}>
                    {nextPhaseLabel}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleEndTurn}
                style={[styles.phaseBtn, { borderColor: colors.violet }]}
                disabled={acting}
              >
                <Text style={[styles.phaseBtnText, { color: colors.violet }]}>
                  Fin du tour
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Main scrollable en bas */}
        <HandStrip
          hand={myState.hand}
          selectedIdx={selectedHandIdx}
          onTapCard={handleHandTap}
          disabled={!isMyTurn || currentPhase === 'battle' || acting}
          styles={styles}
          colors={colors}
        />

        {/* Chat flottant */}
        <TouchableOpacity
          onPress={() => setChatOpen(true)}
          style={[styles.chatFab, { borderColor: colors.gold }]}
          activeOpacity={0.85}
        >
          <Text style={styles.chatFabText}>Chat</Text>
          {duel.chat_log && duel.chat_log.length > 0 && (
            <View style={[styles.chatFabDot, { backgroundColor: colors.magenta }]}>
              <Text style={styles.chatFabDotText}>{duel.chat_log.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <ChatModal
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={duel.chat_log ?? []}
          onSend={handleSendChat}
          meId={user?.id ?? -1}
          meUsername={myUser?.username ?? 'moi'}
          foeUsername={foeUser?.username ?? 'adversaire'}
          styles={styles}
          colors={colors}
        />

        {/* Overlay fin de partie */}
        {finished && (
          <View style={styles.finishOverlay}>
            <Text
              style={[
                styles.finishText,
                { color: iWon ? colors.gold : colors.magenta },
              ]}
            >
              {iWon ? 'VICTOIRE' : 'DEFAITE'}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.finishBtn, { borderColor: iWon ? colors.gold : colors.magenta }]}
            >
              <Text
                style={[
                  styles.finishBtnText,
                  { color: iWon ? colors.gold : colors.magenta },
                ]}
              >
                Retour
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════

interface PlayerBoardProps {
  side: Side;
  state: PlayerBoardState;
  user: { username?: string } | null | undefined;
  lp: number;
  isMyTurn: boolean;
  selectedAttackerSlot: number | null;
  onEmptyZoneTap: (zone: 'monster' | 'spelltrap' | 'field', slotIndex?: number) => void;
  onCardTap: (zone: 'monster' | 'spelltrap' | 'field', slotIndex: number, bc: BoardCard) => void;
  /** Uniquement pour side='foe' : tapper la row monstres vides = attaque directe */
  onFoeEmptyMonsterRowAttack?: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function PlayerBoard({
  side,
  state,
  user,
  lp,
  isMyTurn,
  selectedAttackerSlot,
  onEmptyZoneTap,
  onCardTap,
  onFoeEmptyMonsterRowAttack,
  styles,
  colors,
}: PlayerBoardProps) {
  const isMe = side === 'me';
  const label = user?.username || (isMe ? 'moi' : 'adversaire');
  const lpColor = lp <= 2000 ? colors.magenta : lp <= 4000 ? colors.gold : colors.text;

  return (
    <View style={styles.boardWrap}>
      {/* Ligne meta : nom + LP + compteurs */}
      <View style={styles.boardMetaRow}>
        <View style={styles.boardIdentity}>
          <View
            style={[
              styles.boardAvatar,
              { borderColor: isMe ? colors.gold : colors.magenta },
            ]}
          >
            <Text style={styles.boardAvatarText}>
              {label.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.boardName}>@{label}</Text>
            {isMyTurn && (
              <Text style={[styles.boardTurnTag, { color: colors.gold }]}>
                A JOUER
              </Text>
            )}
          </View>
        </View>

        <View style={styles.boardLpBox}>
          <Text style={styles.boardLpLabel}>LP</Text>
          <Text style={[styles.boardLpValue, { color: lpColor }]}>{lp}</Text>
        </View>
      </View>

      {/* Rangees zones — pour l'adversaire, on inverse l'ordre visuel
          (spellTraps en haut, monstres en bas — plus proche du joueur central) */}
      {side === 'foe' ? (
        <>
          <ZoneRow
            zone="spelltrap"
            slots={state.spellTraps}
            onEmptyTap={() => {}}
            onCardTap={(slot, bc) => onCardTap('spelltrap', slot, bc)}
            faceHidden
            styles={styles}
            colors={colors}
          />
          <ZoneRow
            zone="monster"
            slots={state.monsters}
            selectedSlot={null}
            onEmptyTap={onFoeEmptyMonsterRowAttack}
            onCardTap={(slot, bc) => onCardTap('monster', slot, bc)}
            highlightAsTarget={selectedAttackerSlot !== null}
            faceHidden
            styles={styles}
            colors={colors}
          />
        </>
      ) : (
        <>
          <ZoneRow
            zone="monster"
            slots={state.monsters}
            selectedSlot={selectedAttackerSlot}
            onEmptyTap={(slot) => onEmptyZoneTap('monster', slot)}
            onCardTap={(slot, bc) => onCardTap('monster', slot, bc)}
            styles={styles}
            colors={colors}
          />
          <ZoneRow
            zone="spelltrap"
            slots={state.spellTraps}
            onEmptyTap={(slot) => onEmptyZoneTap('spelltrap', slot)}
            onCardTap={(slot, bc) => onCardTap('spelltrap', slot, bc)}
            styles={styles}
            colors={colors}
          />
        </>
      )}

      {/* Rangee terrain / deck / cim / bann */}
      <View style={styles.boardBottomRow}>
        <TouchableOpacity
          style={[
            styles.fieldZone,
            state.field && { borderColor: colors.rarityUltra },
          ]}
          onPress={() =>
            state.field
              ? isMe
                ? onCardTap('field', 0, state.field)
                : undefined
              : isMe
                ? onEmptyZoneTap('field')
                : undefined
          }
          activeOpacity={isMe ? 0.7 : 1}
        >
          {state.field ? (
            <CardMini bc={state.field} colors={colors} />
          ) : (
            <Text style={styles.zoneLabel}>TERRAIN</Text>
          )}
        </TouchableOpacity>

        <View style={styles.countersRow}>
          <View style={styles.counterCell}>
            <Text style={styles.counterLabel}>Deck</Text>
            <Text style={[styles.counterVal, { color: colors.violet }]}>
              {state.deck.length}
            </Text>
          </View>
          <View style={styles.counterCell}>
            <Text style={styles.counterLabel}>Cim.</Text>
            <Text style={[styles.counterVal, { color: colors.magenta }]}>
              {state.graveyard.length}
            </Text>
          </View>
          <View style={styles.counterCell}>
            <Text style={styles.counterLabel}>Bann.</Text>
            <Text style={[styles.counterVal, { color: colors.cyan }]}>
              {state.banished.length}
            </Text>
          </View>
          {!isMe && (
            <View style={styles.counterCell}>
              <Text style={styles.counterLabel}>Main</Text>
              <Text style={[styles.counterVal, { color: colors.text }]}>
                {state.hand.length}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── ZoneRow ───────────────────────────────────────────────────────────────

interface ZoneRowProps {
  zone: 'monster' | 'spelltrap';
  slots: (BoardCard | null)[];
  selectedSlot?: number | null;
  onEmptyTap?: (slot: number) => void;
  onCardTap: (slot: number, bc: BoardCard) => void;
  /** Le cote adverse : cache les cartes face-down (deja gere par la maquette) */
  faceHidden?: boolean;
  /** Zone entiere surlignee comme cible potentielle (phase battle, tap possible) */
  highlightAsTarget?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function ZoneRow({
  slots,
  selectedSlot,
  onEmptyTap,
  onCardTap,
  faceHidden: _faceHidden,
  highlightAsTarget,
  styles,
  colors,
}: ZoneRowProps) {
  return (
    <View style={styles.zoneRow}>
      {slots.map((bc, i) => {
        const isSelected = selectedSlot === i;
        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.zoneSlot,
              !bc && styles.zoneSlotEmpty,
              bc && { borderColor: colors.rarityUltra, backgroundColor: colors.panel2 },
              isSelected && { borderColor: colors.gold, borderWidth: 2 },
              highlightAsTarget && !bc && { borderColor: colors.magenta, borderStyle: 'dashed' },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (bc) onCardTap(i, bc);
              else onEmptyTap?.(i);
            }}
          >
            {bc ? (
              <CardMini bc={bc} colors={colors} />
            ) : (
              <Text style={styles.zoneLabel}>·</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── CardMini ─────────────────────────────────────────────────────────────

function CardMini({
  bc,
  colors,
}: {
  bc: BoardCard;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const img = bc.card.card?.card_images?.[0]?.image_url_small;
  if (bc.faceDown) {
    return (
      <View
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: colors.violet,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.gold,
        }}
      >
        <Text style={{ color: colors.gold, fontSize: 8, fontWeight: '900' }}>YGO</Text>
      </View>
    );
  }
  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        transform: bc.defenseMode ? [{ rotate: '90deg' }] : undefined,
      }}
    >
      {img ? (
        <Image
          source={{ uri: img }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: colors.panel2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 8 }}>?</Text>
        </View>
      )}
    </View>
  );
}

// ─── HandStrip ─────────────────────────────────────────────────────────────

interface HandStripProps {
  hand: PlayerBoardState['hand'];
  selectedIdx: number | null;
  onTapCard: (idx: number) => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function HandStrip({
  hand,
  selectedIdx,
  onTapCard,
  disabled,
  styles,
  colors,
}: HandStripProps) {
  return (
    <View
      style={[
        styles.handStrip,
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.handLabel}>MAIN · {hand.length}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 6 }}
      >
        {hand.length === 0 ? (
          <Text style={styles.emptyHandText}>Main vide.</Text>
        ) : (
          hand.map((dc, i) => {
            const img = dc.card?.card_images?.[0]?.image_url_small;
            const isSelected = selectedIdx === i;
            return (
              <TouchableOpacity
                key={`${dc.id}-${i}`}
                onPress={() => onTapCard(i)}
                disabled={disabled}
                activeOpacity={0.85}
                style={[
                  styles.handCard,
                  isSelected && {
                    borderColor: colors.gold,
                    borderWidth: 2,
                    transform: [{ translateY: -6 }],
                  },
                ]}
              >
                {img ? (
                  <Image
                    source={{ uri: img }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.handCardFallback}>?</Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ─── ChatModal ────────────────────────────────────────────────────────────

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  messages: DuelChatMessage[];
  onSend: (message: string) => void | Promise<void>;
  meId: number;
  meUsername: string;
  foeUsername: string;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}

function ChatModal({
  visible,
  onClose,
  messages,
  onSend,
  meId,
  meUsername,
  foeUsername,
  styles,
  colors,
}: ChatModalProps) {
  const [draft, setDraft] = useState('');
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.at.localeCompare(b.at)),
    [messages]
  );

  const send = async () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    await onSend(t);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.chatOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.chatPanel}
        >
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Chat du duel</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.chatClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 6 }}>
            {sortedMessages.length === 0 ? (
              <Text style={styles.emptyText}>Pas encore de message.</Text>
            ) : (
              sortedMessages.map((m, i) => {
                const isMe = m.user_id === meId;
                return (
                  <View
                    key={`${m.at}-${i}`}
                    style={[
                      styles.chatBubble,
                      {
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        borderColor: isMe ? colors.gold : colors.violet,
                      },
                    ]}
                  >
                    <Text style={styles.chatFrom}>
                      @{isMe ? meUsername : m.username || foeUsername}
                    </Text>
                    <Text style={styles.chatBody}>{m.message}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Ecris un message…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity onPress={send} style={styles.chatSend} disabled={!draft.trim()}>
              <Text style={styles.chatSendText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyText: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },

    header: {
      height: 52,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.bgElev,
    },
    chromeBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chromeBtnText: { fontSize: 20, color: t.colors.text },
    headerTitle: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    headerSub: {
      marginTop: 2,
      fontSize: 10,
      color: t.colors.textMuted,
      letterSpacing: 0.8,
    },

    body: { padding: 10, paddingBottom: 20, gap: 8 },

    // ─── Board ───────────────────────────────────────
    boardWrap: {
      padding: 10,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 6,
    },
    boardMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    boardIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    boardAvatar: {
      width: 34,
      height: 34,
      borderWidth: 1,
      backgroundColor: t.colors.panel2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boardAvatarText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '900',
      color: t.colors.text,
    },
    boardName: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: t.colors.text,
    },
    boardTurnTag: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    boardLpBox: {
      alignItems: 'flex-end',
    },
    boardLpLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 1.4,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    boardLpValue: {
      fontFamily: 'sans-serif',
      fontSize: 18,
      fontWeight: '900',
    },

    zoneRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    zoneSlot: {
      flex: 1,
      maxWidth: 62,
      aspectRatio: 0.72,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.bgElev,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    zoneSlotEmpty: {
      borderStyle: 'dashed',
      borderColor: 'rgba(245,197,24,0.22)',
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    zoneLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      color: t.colors.textMuted,
      letterSpacing: 0.6,
      opacity: 0.7,
    },

    boardBottomRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 6,
    },
    fieldZone: {
      width: 62,
      aspectRatio: 0.72,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderStyle: 'dashed',
      backgroundColor: t.colors.bgElev,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    countersRow: {
      flex: 1,
      flexDirection: 'row',
      gap: 4,
    },
    counterCell: {
      flex: 1,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    counterLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      color: t.colors.textMuted,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    counterVal: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '900',
    },

    // ─── Turn band ───────────────────────────────────
    turnBand: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    turnBadge: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderWidth: 1,
    },
    turnBadgeText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    turnPhase: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },

    // ─── Phase buttons ───────────────────────────────
    phaseRow: {
      marginTop: 4,
      flexDirection: 'row',
      gap: 8,
    },
    phaseBtn: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.panel,
    },
    phaseBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },

    // ─── Hand strip ──────────────────────────────────
    handStrip: {
      paddingVertical: 8,
      paddingHorizontal: 6,
      backgroundColor: t.colors.bgElev,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    handLabel: {
      paddingHorizontal: 8,
      paddingBottom: 4,
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 1.6,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    handCard: {
      width: 60,
      height: 84,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    handCardFallback: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      color: t.colors.textMuted,
    },
    emptyHandText: {
      fontSize: 11,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      paddingHorizontal: 12,
      alignSelf: 'center',
    },

    // ─── Chat FAB ────────────────────────────────────
    chatFab: {
      position: 'absolute',
      right: 14,
      bottom: 118,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      backgroundColor: t.colors.bgElev,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    chatFabText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },
    chatFabDot: {
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatFabDotText: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      fontWeight: '900',
      color: t.colors.bg,
    },

    // ─── Chat modal ──────────────────────────────────
    chatOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    chatPanel: {
      backgroundColor: t.colors.panel,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      maxHeight: '80%',
      minHeight: 320,
      flexDirection: 'column',
    },
    chatHeader: {
      padding: 14,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    chatTitle: {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    chatClose: { fontSize: 20, color: t.colors.textMuted },
    chatBubble: {
      maxWidth: '80%',
      padding: 10,
      borderWidth: 1,
      backgroundColor: t.colors.bgElev,
    },
    chatFrom: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
    },
    chatBody: {
      marginTop: 4,
      fontSize: 13,
      color: t.colors.text,
      lineHeight: 18,
    },
    chatInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    chatInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 100,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      color: t.colors.text,
      fontSize: 13,
    },
    chatSend: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.10)',
    },
    chatSendText: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.colors.gold,
    },

    // ─── Finish overlay ──────────────────────────────
    finishOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.85)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    finishText: {
      fontFamily: 'sans-serif',
      fontSize: 48,
      fontWeight: '900',
      letterSpacing: 4,
      textTransform: 'uppercase',
    },
    finishBtn: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderWidth: 1,
    },
    finishBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
  });
