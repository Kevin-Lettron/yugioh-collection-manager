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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuth } from '@/context/AuthContext';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { duelApi } from '@/services/duelApi';
import duelEngineApi, { type DuelAnnounceSearchResult } from '@/services/duelEngineApi';
import type {
  Duel,
  DuelAnimationEvent,
  DuelCardView,
  DuelChoice,
  DuelClocks,
  DuelCombatLogEntry,
  DuelLogEntry,
  DuelPreGameState,
  DuelPrompt,
  DuelPromptOption,
  DuelRevealBatch,
  DuelSeat,
  DuelSideView,
  DuelStateResponse,
  DuelTossEvent,
} from '@/types';

/**
 * Arène pilotée par ygopro-core — miroir mobile portrait de
 * `client/src/pages/EngineDuelRoom.tsx` (F8 du PLAN-DUEL-AMELIORATIONS).
 *
 * Bloc 5 · **Portage complet des UX ajoutés en Bloc 3** :
 *
 *   - `CardActionMenu` bufferisé (§4bis) — rien n'est envoyé au serveur avant
 *     Valider, l'adversaire ne voit rien tant que le joueur n'a pas confirmé.
 *   - `JournalPanel` à deux onglets (Actions / Déroulé).
 *   - `RevealOverlay` — cartes révélées CONFIRM_CARDS / _DECKTOP / _EXTRATOP.
 *   - `TossOverlay` — pile ou face et lancers de dés en superposition.
 *   - `CombatLogFeed` — narration attaques + toast rouge sur missed_effect.
 *   - `AnimationLayer` + `DrawAnimation` — glyphes typés Xyz/Synchro/Link/…
 *   - `CounterModal`, `AnnounceCardModal` — SELECT_COUNTER, ANNOUNCE_CARD.
 *   - Extra Deck adverse consultable (public en YGO — règle officielle §C.4).
 *   - Confirmation « Terminer ton tour ? » (§C.3).
 *   - Indication de portée sur les prompts multi-cibles (§C.2).
 *   - Toast rouge RETRY quand le moteur refuse une réponse.
 *
 * Bloc 5 · **Temps réel via socket.io** — le polling passe en filet de
 * secours (5 s au lieu de 1.5 s tant que le socket est connecté) ; les
 * refresh sont poussés par les events `duel:engine_update`.
 */
const cardImg = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`;

const cardImgLarge = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards/${code}.jpg`;

const PHASE_LABEL: Record<string, string> = {
  draw: 'Draw Phase',
  standby: 'Standby',
  main1: 'Main Phase 1',
  battle_start: 'Battle',
  battle_step: 'Battle Step',
  damage: 'Damage',
  damage_cal: 'Damage Calc',
  battle: 'Battle Phase',
  main2: 'Main Phase 2',
  end: 'End Phase',
  unknown: '—',
};

/** Catégorisation des lignes de journal — §C.1, miroir web. */
const ACTION_KINDS = new Set([
  'summoning', 'spsummoning', 'flipsummoning', 'chaining', 'attack',
  'set', 'damage', 'recover', 'pay_lpcost', 'win', 'toss_coin', 'toss_dice',
]);

function categorizeLog(entry: DuelLogEntry): 'actions' | 'flow' {
  return ACTION_KINDS.has(entry.kind) ? 'actions' : 'flow';
}

export default function EngineDuelScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = Number(id);
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<DuelStateResponse | null>(null);
  const [duel, setDuel] = useState<Duel | null>(null);
  const [preGame, setPreGame] = useState<DuelPreGameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [detailCard, setDetailCard] = useState<DuelCardView | null>(null);
  const [logTab, setLogTab] = useState<'actions' | 'flow'>('actions');
  const [socketAlive, setSocketAlive] = useState(false);

  /**
   * Menu contextuel bufferisé — §4bis. Aucun envoi au serveur avant Valider.
   */
  const [cardMenu, setCardMenu] = useState<
    | {
        title: string;
        card: DuelCardView | null;
        options: DuelPromptOption[];
        pickedId: string | null;
      }
    | null
  >(null);

  /** Extra Deck / Cimetière / Bannies — mine ou adverse (§C.4). */
  const [openZone, setOpenZone] = useState<
    | { kind: 'extra' | 'grave' | 'banished'; side: 'me' | 'foe' }
    | null
  >(null);

  /** Confirmation Phase de Fin — §C.3. */
  const [endTurnConfirm, setEndTurnConfirm] = useState<{ optionId: string } | null>(null);
  const [endTurnMuted, setEndTurnMuted] = useState(false);

  /** Toast RETRY — clignotement filtré via lastRetryShownAt. */
  const [retryToast, setRetryToast] = useState<string | null>(null);
  const lastRetryShownAt = useRef<number | null>(null);

  // ── Chargement initial : d'abord `start` (résout pré-game ou lance moteur).
  const start = useCallback(async () => {
    if (!Number.isFinite(duelId)) return;
    try {
      const res = await duelEngineApi.start(duelId);
      if (res.kind === 'pre_game') {
        setPreGame(res.preGame);
        setState(null);
      } else {
        setPreGame(null);
        setState(res.state);
      }
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error?.message ?? 'Impossible d\'ouvrir le duel');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [duelId, router]);

  useEffect(() => {
    if (!Number.isFinite(duelId)) return;
    // Salle d'attente (migration 014) — si les 2 joueurs n'ont pas encore
    // cliqué « Prêt » ET que le pile ou face n'a pas démarré, on renvoie
    // dans le lobby au lieu d'ouvrir le moteur (qui refuserait de toute façon).
    duelApi
      .get(duelId)
      .then((d) => {
        setDuel(d);
        const bothReady = Boolean(d.challenger_ready && d.opponent_ready);
        const skipLobby = d.phase_pre_game || d.first_player_id || bothReady ||
          d.status === 'finished' || d.status === 'cancelled';
        if (!skipLobby) {
          router.replace(`/duel/lobby/${duelId}` as any);
          return;
        }
        start();
      })
      .catch(() => {
        // Duel introuvable — on tente quand même start() pour respecter le comportement legacy.
        start();
      });
  }, [duelId, start, router]);

  /**
   * CHANTIER 2 — verrou landscape à l'entrée du duel + libération à la sortie.
   *
   * On lock uniquement le duel moteur (pas toute l'app) — le reste de l'app
   * fonctionne en portrait, seul le plateau exige un format wide pour tenir
   * les 5 zones monstre + PZones + EMZ des deux camps.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch {
        // Certains devices refusent le lock — on continue en portrait, le
        // layout reste utilisable même dégradé.
      }
    })();
    return () => {
      cancelled = true;
      ScreenOrientation.unlockAsync().catch(() => undefined);
      void cancelled;
    };
  }, []);

  // ── Refresh : `view` si moteur actif, sinon `preGame`.
  const refresh = useCallback(async () => {
    try {
      if (preGame && preGame.phase !== 'resolved') {
        const p = await duelEngineApi.preGame(duelId);
        setPreGame(p);
        if (p.phase === 'resolved') await start();
      } else {
        const s = await duelEngineApi.view(duelId);
        setState(s);
      }
    } catch {
      /* transient */
    }
  }, [duelId, preGame, start]);

  // ── Abonnement socket + poll de secours.
  useEffect(() => {
    if (!Number.isFinite(duelId)) return undefined;

    // Souscription socket — refresh sur event, cf. duelEngineApi.subscribe.
    const unsub = duelEngineApi.subscribe(duelId, {
      onUpdate: () => {
        setSocketAlive(true);
        if (!busyRef.current) void refresh();
      },
      onPreGame: (p) => setPreGame(p),
      onFinished: ({ reason }) => {
        const label = reason === 'surrender' ? 'Abandon' : reason === 'timeout' ? 'Temps écoulé' : 'Fin de partie';
        Alert.alert('Partie terminée', label);
        void refresh();
      },
      onEngineLost: () => {
        Alert.alert('Duel interrompu', 'La partie est annulée, sans défaite.');
      },
    });

    // Filet : poll rapide (1.5 s) tant que le socket n'a pas montré signe de
    // vie, puis 5 s une fois qu'on reçoit des events.
    const poll = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, socketAlive ? 5000 : 1500);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [duelId, refresh, socketAlive]);

  // ── RETRY toast — apparaît au reçu d'un lastRetry, filtré par timestamp.
  useEffect(() => {
    const retry = state?.lastRetry;
    if (!retry) {
      lastRetryShownAt.current = null;
      return;
    }
    if (lastRetryShownAt.current === retry.at) return;
    lastRetryShownAt.current = retry.at;
    setRetryToast(retry.note ?? 'Coup refusé — reprends ton choix.');
    const t = setTimeout(() => setRetryToast(null), 3500);
    return () => clearTimeout(t);
  }, [state?.lastRetry]);

  // ── Envoi d'un choix (moteur).
  const send = useCallback(
    async (
      optionIds: string[],
      cancel = false,
      extra?: Pick<DuelChoice, 'counters' | 'announcedCode' | 'cardCodes'>
    ) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setCardMenu(null);
      setEndTurnConfirm(null);
      try {
        const choice: DuelChoice = { optionIds, cancel, ...(extra ?? {}) };
        const next = await duelEngineApi.choose(duelId, choice);
        setState(next);
      } catch (err: any) {
        Alert.alert('Coup refusé', err?.response?.data?.error?.message ?? 'Le moteur a refusé ce coup');
        await refresh();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [duelId, refresh]
  );

  // ── Abandon (F2).
  const surrender = useCallback(() => {
    Alert.alert(
      'Abandonner ?',
      'Tu perdras cette partie. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: async () => {
            try {
              await duelEngineApi.surrender(duelId);
              Alert.alert('Partie terminée', 'Tu as abandonné.');
              router.back();
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error?.message ?? 'Impossible');
            }
          },
        },
      ]
    );
  }, [duelId, router]);

  /**
   * Détermine si la fin de tour mérite une confirmation — §C.3.
   * Copie stricte du web.
   */
  const shouldConfirmEndTurn = useCallback((): boolean => {
    if (endTurnMuted || !state) return false;
    const { board } = state;
    if (board.phase === 'main1' && board.me.hand.length > 0) return true;
    if (
      board.phase === 'battle' || board.phase === 'battle_start' || board.phase === 'battle_step'
    ) {
      const hasReadyMonster = board.me.monsters.some(
        (m) => m && !m.faceDown && ((m.position ?? 0) & 0x1) !== 0
      );
      if (hasReadyMonster) return true;
    }
    return false;
  }, [endTurnMuted, state]);

  // ── Rendu.
  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.gold} />
      </SafeAreaView>
    );
  }

  if (preGame) {
    return (
      <SafeAreaView style={styles.container}>
        <AppBackground />
        <CornerOrnaments />
        <PreGameView
          state={preGame}
          userId={user?.id ?? 0}
          onFlip={async () => {
            try {
              const p = await duelEngineApi.coinFlip(duelId);
              setPreGame(p);
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error?.message ?? 'Impossible');
            }
          }}
          onChoice={async (choice) => {
            try {
              const p = await duelEngineApi.firstPlayerChoice(duelId, choice);
              setPreGame(p);
              if (p.phase === 'resolved') await start();
            } catch (err: any) {
              Alert.alert('Erreur', err?.response?.data?.error?.message ?? 'Impossible');
            }
          }}
          styles={styles}
        />
      </SafeAreaView>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={styles.loader}>
        <AppBackground />
        <Text style={styles.dim}>État indisponible</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnTxt}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { board, prompt, log, combatLog, clocks, status, winner, winReason, animations, reveals, tosses } = state;
  const myTurn = board.turnPlayer === board.seat;

  // Prompt "needs dialog" — options non atteignables sur le plateau/main.
  const needsDialog =
    prompt &&
    prompt.kind !== 'select_counter' &&
    prompt.kind !== 'announce_card' &&
    prompt.kind !== 'place' &&
    prompt.kind !== 'main' &&
    prompt.kind !== 'battle' &&
    prompt.options.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground />
      <CornerOrnaments />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tour {board.turn} · {PHASE_LABEL[board.phase] ?? board.phase}</Text>
          <Text style={styles.subtitle}>
            {myTurn ? 'À toi de jouer' : "À l'adversaire"}
            {board.chainLength > 0 ? ` · chaîne ${board.chainLength}` : ''}
          </Text>
        </View>
        {clocks && <ClockPill clocks={clocks} seat={board.seat} styles={styles} />}
        <TouchableOpacity style={styles.dangerBtn} onPress={surrender}>
          <Text style={styles.dangerTxt}>Abandonner</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        {/* Plateau adverse (miroir horizontal — spells au-dessus, monstres en-dessous) */}
        <BoardSide
          side={board.opponent}
          seat={board.seat === 0 ? 1 : 0}
          isFoe
          label="Adversaire"
          promptOptions={prompt?.seat === board.seat ? (prompt?.options ?? []) : []}
          styles={styles}
          onCardTap={setDetailCard}
          onOpenZone={(kind) => setOpenZone({ kind, side: 'foe' })}
          onCardMenu={(card, opts) =>
            setCardMenu({
              title: card.name ?? 'Carte',
              card,
              options: opts,
              pickedId: null,
            })
          }
          onOptionPicked={(id) => void send([id])}
        />

        {/* EMZ partagées, entre les deux camps (Master Rule 5) */}
        <ExtraMonsterZones
          meSide={board.me}
          foeSide={board.opponent}
          mySeat={board.seat}
          promptOptions={prompt?.seat === board.seat ? (prompt?.options ?? []) : []}
          onCardTap={setDetailCard}
          onCardMenu={(card, opts) =>
            setCardMenu({
              title: card.name ?? 'Carte',
              card,
              options: opts,
              pickedId: null,
            })
          }
          onOptionPicked={(id) => void send([id])}
          styles={styles}
        />

        {/* Plateau joueur */}
        <BoardSide
          side={board.me}
          seat={board.seat}
          isFoe={false}
          label="Toi"
          promptOptions={prompt?.seat === board.seat ? (prompt?.options ?? []) : []}
          styles={styles}
          onCardTap={setDetailCard}
          onOpenZone={(kind) => setOpenZone({ kind, side: 'me' })}
          onCardMenu={(card, opts) =>
            setCardMenu({
              title: card.name ?? 'Carte',
              card,
              options: opts,
              pickedId: null,
            })
          }
          onOptionPicked={(id) => void send([id])}
        />

        {/* Rail chaîne — visible pendant qu'une chaîne est en cours */}
        {board.chain && board.chain.length > 0 && (
          <ChainPanelMobile
            chain={board.chain}
            solvingLink={board.chainSolvingLink ?? null}
            mySeat={board.seat}
            styles={styles}
          />
        )}

        {/* LP mis en avant */}
        <View style={styles.lpRow}>
          <View style={styles.lpBox}>
            <Text style={styles.lpLabel}>ADV</Text>
            <Text style={styles.lpValue}>{board.opponent.lp}</Text>
          </View>
          <View style={styles.lpBox}>
            <Text style={[styles.lpLabel, { color: colors.gold }]}>TOI</Text>
            <Text style={[styles.lpValue, { color: colors.gold }]}>{board.me.lp}</Text>
          </View>
        </View>

        {/* Message d'attente / prompt en cours */}
        <View style={styles.hintBanner}>
          <Text style={[styles.hintTxt, prompt && { color: colors.gold }]}>
            {prompt ? (prompt.hint?.title ?? prompt.message) : "En attente de l'adversaire…"}
          </Text>
          {prompt?.hint?.note && (
            <Text style={styles.dim}>{prompt.hint.note}</Text>
          )}
        </View>

        {/* Journal à onglets (§C.1) */}
        <JournalPanel log={log} tab={logTab} onTab={setLogTab} styles={styles} colors={colors} />

        {/* Combat log — 6 dernières lignes (public) */}
        {combatLog && combatLog.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Combat</Text>
            {combatLog.slice(-6).map((c, i) => (
              <Text
                key={i}
                style={[
                  styles.logLine,
                  (c.kind === 'missed_effect' || c.kind === 'chain_negated' || c.kind === 'attack_disabled') && {
                    color: colors.danger,
                  },
                ]}
              >
                › {c.description}
              </Text>
            ))}
          </View>
        )}

        {status === 'ended' && (
          <View style={[styles.panel, { borderColor: colors.gold, backgroundColor: 'rgba(212,160,23,0.15)' }]}>
            <Text style={[styles.panelTitle, { color: colors.gold }]}>
              {winner !== null && winner !== undefined && winner === board.seat ? 'Victoire' : 'Défaite'}
            </Text>
            {winReason && <Text style={styles.dim}>{winReason}</Text>}
            <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
              <Text style={styles.btnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Main scrollable en bas (fixe) */}
      {board.me.hand.length > 0 && (
        <ScrollView
          horizontal
          style={styles.handBar}
          contentContainerStyle={{ padding: 8, gap: 6 }}
          showsHorizontalScrollIndicator={false}
        >
          {board.me.hand.map((c, i) => {
            /**
             * §4bis — les options d'une carte sont retrouvées par sa
             * **position** dans la main (pas par passcode : deux exemplaires
             * de la même carte donneraient les mêmes options si on filtrait
             * par code).
             */
            const options = (prompt?.options ?? []).filter(
              (o) => o.location === 0x2 && o.sequence === i
            );
            const actionable = options.length > 0;
            return (
              <TouchableOpacity
                key={`${c.code}-${i}`}
                onLongPress={() => setDetailCard(c)}
                onPress={() => {
                  if (actionable) {
                    setCardMenu({
                      title: c.name ?? 'Carte',
                      card: c,
                      options,
                      pickedId: null,
                    });
                  } else {
                    setDetailCard(c);
                  }
                }}
                style={[
                  styles.handCard,
                  actionable && { borderColor: colors.gold, borderWidth: 2 },
                ]}
              >
                {c.code ? (
                  <Image source={{ uri: cardImg(c.code) }} style={styles.handImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.dim}>?</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Prompt overlay bas — sélection multiple sur cartes en modal centralisé */}
      {prompt && needsDialog && (
        <PromptModal
          prompt={prompt}
          onChoose={(ids, cancel) => {
            if (ids.length === 1 && ids[0] === 'toep' && shouldConfirmEndTurn()) {
              setEndTurnConfirm({ optionId: 'toep' });
              return;
            }
            void send(ids, cancel);
          }}
          busy={busy}
          styles={styles}
          colors={colors}
        />
      )}

      {/* Prompt cases (place) — rappel bas de plateau */}
      {prompt && prompt.kind === 'place' && (
        <View style={styles.prompt}>
          <Text style={styles.promptTitle}>{prompt.message}</Text>
          <Text style={styles.dim}>Choisis une case libre :</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 6, padding: 4 }}>
            {prompt.options.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.optBtn}
                onPress={() => void send([o.id])}
                disabled={busy}
              >
                <Text style={styles.optLbl}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Prompt main/battle — actions non liées à une carte (change de phase) */}
      {prompt && (prompt.kind === 'main' || prompt.kind === 'battle') && (
        <PhaseActionsBar
          prompt={prompt}
          onChoose={(id) => {
            if (id === 'toep' && shouldConfirmEndTurn()) {
              setEndTurnConfirm({ optionId: id });
              return;
            }
            void send([id]);
          }}
          busy={busy}
          styles={styles}
        />
      )}

      {/* ── Menu contextuel bufferisé (§4bis) — RIEN n'est envoyé avant Valider */}
      {cardMenu && (
        <CardActionMenu
          menu={cardMenu}
          busy={busy}
          onPick={(id) => setCardMenu((cur) => (cur ? { ...cur, pickedId: id } : cur))}
          onValidate={() => {
            if (!cardMenu.pickedId) return;
            if (cardMenu.pickedId === 'toep' && shouldConfirmEndTurn()) {
              const optionId = cardMenu.pickedId;
              setCardMenu(null);
              setEndTurnConfirm({ optionId });
              return;
            }
            void send([cardMenu.pickedId]);
          }}
          onCancel={() => setCardMenu(null)}
          styles={styles}
          colors={colors}
        />
      )}

      {/* Ouverture d'une zone (mon Extra/Cimetière/Bannies OU Extra/Cimetière adverse) */}
      {openZone && (
        <ZoneModal
          zone={openZone}
          side={openZone.side === 'me' ? board.me : board.opponent}
          onClose={() => setOpenZone(null)}
          onCardTap={setDetailCard}
          styles={styles}
          colors={colors}
        />
      )}

      {/* Confirmation Phase de Fin (§C.3) */}
      {endTurnConfirm && (
        <ConfirmEndTurnModal
          hand={board.me.hand.length}
          phase={board.phase}
          muted={endTurnMuted}
          onMute={setEndTurnMuted}
          onConfirm={() => {
            const optionId = endTurnConfirm.optionId;
            setEndTurnConfirm(null);
            void send([optionId]);
          }}
          onCancel={() => setEndTurnConfirm(null)}
          busy={busy}
          styles={styles}
          colors={colors}
        />
      )}

      {/* SELECT_COUNTER modal */}
      {prompt?.kind === 'select_counter' && prompt.counter && (
        <CounterModal
          prompt={prompt}
          busy={busy}
          onConfirm={(counters) => void send([], false, { counters })}
          styles={styles}
          colors={colors}
        />
      )}

      {/* ANNOUNCE_CARD modal (typeahead) */}
      {prompt?.kind === 'announce_card' && (
        <AnnounceCardModal
          duelId={duelId}
          busy={busy}
          onConfirm={(code) => void send([], false, { announcedCode: code })}
          styles={styles}
          colors={colors}
        />
      )}

      {/* Cartes révélées (CONFIRM_CARDS / DECKTOP / EXTRATOP) */}
      <RevealOverlay reveals={reveals ?? []} styles={styles} colors={colors} />

      {/* Lancers de pièce / dés */}
      <TossOverlay tosses={tosses ?? []} styles={styles} colors={colors} />

      {/* Animations §3.2 — glyphes typés, DrawAnimation en superposition */}
      <AnimationLayer animations={animations ?? []} styles={styles} colors={colors} />

      {/* Toast RETRY */}
      {retryToast && (
        <View style={styles.retryToast} pointerEvents="none">
          <Text style={styles.retryTxt}>⛔ {retryToast}</Text>
        </View>
      )}

      {/* Détail carte (modal, long-press ou tap non-actionnable) */}
      <Modal transparent visible={!!detailCard} onRequestClose={() => setDetailCard(null)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setDetailCard(null)}>
          {detailCard && (
            <View style={styles.modalContent}>
              {detailCard.code ? (
                <Image source={{ uri: cardImgLarge(detailCard.code) }} style={styles.modalImg} resizeMode="contain" />
              ) : null}
              <Text style={styles.modalTitle}>{detailCard.name ?? 'Carte cachée'}</Text>
              {detailCard.description && (
                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={styles.modalDesc}>{detailCard.description}</Text>
                </ScrollView>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function PreGameView({
  state,
  userId,
  onFlip,
  onChoice,
  styles,
}: {
  state: DuelPreGameState;
  userId: number;
  onFlip: () => void;
  onChoice: (c: 'P1' | 'P2') => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const iAmReady = state.playersReady.includes(userId);
  const iWon = state.winnerId === userId;

  return (
    <View style={{ padding: 24, gap: 16, flex: 1, justifyContent: 'center' }}>
      <Text style={[styles.title, { fontSize: 22, textAlign: 'center' }]}>Pile ou face</Text>
      {state.phase === 'awaiting_flip' && (
        <View style={{ gap: 12 }}>
          <Text style={[styles.dim, { textAlign: 'center' }]}>
            Chaque joueur clique pour lancer la pièce ({state.playersReady.length}/2 prêts).
          </Text>
          <TouchableOpacity
            style={[styles.btn, iAmReady && { opacity: 0.5 }]}
            onPress={onFlip}
            disabled={iAmReady}
          >
            <Text style={styles.btnTxt}>{iAmReady ? 'En attente…' : 'Lancer la pièce'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {state.phase === 'awaiting_choice' && (
        <View style={{ gap: 12 }}>
          {iWon ? (
            <>
              <Text style={[styles.dim, { textAlign: 'center' }]}>
                Tu as gagné le pile ou face. Choisis :
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => onChoice('P1')}>
                <Text style={styles.btnTxt}>Je commence (P1)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => onChoice('P2')}>
                <Text style={styles.btnTxt}>L'adversaire commence (P2)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.dim, { textAlign: 'center' }]}>
              L'adversaire a gagné le pile ou face — il choisit qui commence.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function ClockPill({
  clocks,
  seat,
  styles,
}: {
  clocks: DuelClocks;
  seat: DuelSeat;
  styles: ReturnType<typeof makeStyles>;
}) {
  const myMs = seat === 0 ? clocks.p1Ms : clocks.p2Ms;
  const foeMs = seat === 0 ? clocks.p2Ms : clocks.p1Ms;
  const fmt = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const running = clocks.runningFor;
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginRight: 8 }}>
      <View style={[styles.clockPill, running === seat && styles.clockPillActive]}>
        <Text style={styles.clockTxt}>Toi</Text>
        <Text style={[styles.clockValue, myMs < 30_000 && running === seat && { color: '#FF4D6D' }]}>
          {fmt(myMs)}
        </Text>
      </View>
      <View style={[styles.clockPill, running !== seat && running !== null && styles.clockPillActive]}>
        <Text style={styles.clockTxt}>Adv.</Text>
        <Text style={styles.clockValue}>{fmt(foeMs)}</Text>
      </View>
    </View>
  );
}

/** Constantes de zones du moteur — miroir de client/duel/DuelField. */
const LOCATION_MZONE = 0x4;
const LOCATION_SZONE = 0x8;
const POSITION_DEFENSE = 0xc;
const isDefense = (card: DuelCardView | null): boolean =>
  !!card && ((card.position ?? 0) & POSITION_DEFENSE) !== 0;

/**
 * BoardSide — un camp complet en landscape.
 *
 * Contient (dans l'ordre horizontal) : Extra Deck · PZone gauche · 5 zones
 * monstre · PZone droite · Deck OU Field Spell selon la rangée. Les EMZ sont
 * partagées et rendues UNE fois, entre les deux camps (par le composant
 * parent). Miroir de `client/src/components/duel/DuelField.tsx`.
 *
 * `mySeat` désigne le siège local ; sert pour les options SELECT_PLACE / _DISFIELD
 * dont l'indexation `controller` doit être comparée. `promptOptions` = les
 * options du prompt courant ; les cases correspondant sont surlignées et
 * cliquables directement.
 */
function BoardSide({
  side,
  seat,
  isFoe,
  label,
  promptOptions,
  onCardTap,
  onOpenZone,
  onCardMenu,
  onOptionPicked,
  styles,
}: {
  side: DuelSideView;
  /** Siège de ce camp (0 ou 1). */
  seat: DuelSeat;
  /** true si ce camp est celui de l'adversaire — inverse les rangées. */
  isFoe: boolean;
  label: string;
  promptOptions: DuelPromptOption[];
  onCardTap: (c: DuelCardView) => void;
  onOpenZone: (kind: 'extra' | 'grave' | 'banished') => void;
  onCardMenu: (c: DuelCardView, opts: DuelPromptOption[]) => void;
  onOptionPicked: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  // Filtre les options pointant sur ce camp / cette zone.
  const optionsAt = (location: number, sequence: number) =>
    promptOptions.filter(
      (o) => o.controller === seat && o.location === location && o.sequence === sequence
    );

  const renderZone = (location: number, sequence: number, card: DuelCardView | null, extra?: {
    field?: boolean;
    pendulum?: 'left' | 'right';
    emz?: boolean;
  }) => {
    const here = optionsAt(location, sequence);
    const place = here.find((o) => o.code === undefined);
    const targets = here.filter((o) => o.code !== undefined);
    const onPress = () => {
      if (place) return onOptionPicked(place.id);
      if (targets.length >= 1 && card) return onCardMenu(card, targets);
      if (card) return onCardTap(card);
    };
    return (
      <ZoneSlot
        key={`${location}-${sequence}`}
        card={card}
        placeable={!!place}
        actionable={targets.length > 0}
        field={extra?.field}
        pendulum={extra?.pendulum}
        emz={extra?.emz}
        onPress={onPress}
        styles={styles}
      />
    );
  };

  // Rangées : adversaire = pile inversée (spells au-dessus, monstres en-dessous)
  // pour créer l'effet miroir naturel du plateau YGO.
  const monsterRow = (
    <View style={styles.zoneRow}>
      {(isFoe ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]).map((seq) =>
        renderZone(LOCATION_MZONE, seq, side.monsters[seq] ?? null)
      )}
    </View>
  );
  const spellRow = (
    <View style={styles.zoneRow}>
      {/* PZone gauche */}
      {renderZone(LOCATION_SZONE, 6, side.spells[6] ?? null, { pendulum: 'left' })}
      {(isFoe ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4]).map((seq) =>
        renderZone(LOCATION_SZONE, seq, side.spells[seq] ?? null)
      )}
      {/* PZone droite */}
      {renderZone(LOCATION_SZONE, 7, side.spells[7] ?? null, { pendulum: 'right' })}
    </View>
  );
  const fieldSlot = renderZone(LOCATION_SZONE, 5, side.spells[5] ?? null, { field: true });

  return (
    <View style={styles.boardSide}>
      <View style={styles.boardHeader}>
        <Text style={styles.boardLabel}>
          {label} · {side.lp} LP
        </Text>
        <Text style={styles.dim}>
          Main {side.handCount} · Deck {side.deckCount}
        </Text>
      </View>
      {/* Piles latérales + rangées, tout sur une seule ligne pour un plateau landscape */}
      <View style={styles.boardRow}>
        {/* Colonne latérale gauche : Field + Extra + Bannies */}
        <View style={styles.sideCol}>
          {fieldSlot}
          <TouchableOpacity style={styles.pileSmall} onPress={() => onOpenZone('extra')}>
            <Text style={styles.pileLabel}>Extra</Text>
            <Text style={styles.pileValue}>{side.extraCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pileSmall} onPress={() => onOpenZone('banished')}>
            <Text style={styles.pileLabel}>Bannies</Text>
            <Text style={styles.pileValue}>{side.banished.length}</Text>
          </TouchableOpacity>
        </View>
        {/* Zones centrales — ordre inversé pour l'adversaire */}
        <View style={styles.zoneStack}>
          {isFoe ? (
            <>
              {spellRow}
              {monsterRow}
            </>
          ) : (
            <>
              {monsterRow}
              {spellRow}
            </>
          )}
        </View>
        {/* Colonne droite : Deck + Cimetière */}
        <View style={styles.sideCol}>
          <View style={styles.pileSmall}>
            <Text style={styles.pileLabel}>Deck</Text>
            <Text style={styles.pileValue}>{side.deckCount}</Text>
          </View>
          <TouchableOpacity style={styles.pileSmall} onPress={() => onOpenZone('grave')}>
            <Text style={styles.pileLabel}>Cimetière</Text>
            <Text style={styles.pileValue}>{side.graveyard.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * ZoneSlot — case interactive de plateau mobile.
 *
 * - `placeable` : SELECT_PLACE/DISFIELD peut poser ici — bordure cyan.
 * - `actionable` : une option cible cette carte — bordure dorée.
 * - `pendulum` : rendu spécial violet + Scale.
 * - `field` : bordure verte "Terrain".
 * - `emz` : bordure cyan spéciale (Extra Monster Zone).
 * - Monstre en défense : rotation 90° pour lecture immédiate.
 * - `counters` / `materials` : badges en surimpression.
 */
function ZoneSlot({
  card,
  placeable,
  actionable,
  field,
  pendulum,
  emz,
  onPress,
  styles,
}: {
  card: DuelCardView | null;
  placeable?: boolean;
  actionable?: boolean;
  field?: boolean;
  pendulum?: 'left' | 'right';
  emz?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const clickable = placeable || actionable || !!card;
  const border = placeable
    ? '#22d3ee'
    : actionable
      ? '#f5c518'
      : pendulum
        ? '#8b5cf6'
        : field
          ? '#22c55e'
          : emz
            ? '#22d3ee'
            : undefined;
  const defense = isDefense(card);
  const counters = card?.counters ?? null;
  const totalCounters = counters
    ? Object.values(counters).reduce((a, b) => a + b, 0)
    : 0;
  const materials = card?.materials ?? 0;

  return (
    <TouchableOpacity
      style={[
        styles.zone,
        pendulum && { borderColor: '#8b5cf6', borderWidth: 2 },
        (field || emz) && { borderColor: border, borderWidth: 1 },
        border && !pendulum && !field && !emz && { borderColor: border, borderWidth: 2 },
      ]}
      onPress={onPress}
      disabled={!clickable}
    >
      {card ? (
        card.code && !card.faceDown ? (
          <Image
            source={{ uri: cardImg(card.code) }}
            style={
              defense
                ? {
                    width: '90%',
                    height: '90%',
                    transform: [{ rotate: '90deg' }],
                  }
                : { width: '100%', height: '100%' }
            }
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.zoneCover}>{defense ? 'Verso DEF' : 'Verso'}</Text>
        )
      ) : (
        <Text style={styles.zoneCover}>
          {placeable
            ? '＋'
            : pendulum
              ? pendulum === 'left'
                ? 'PG'
                : 'PD'
              : field
                ? 'Terrain'
                : emz
                  ? 'EMZ'
                  : ''}
        </Text>
      )}
      {totalCounters > 0 && card && (
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeTxt}>{totalCounters}</Text>
        </View>
      )}
      {materials > 0 && card && (
        <View style={styles.materialBadge}>
          <Text style={styles.materialBadgeTxt}>X{materials}</Text>
        </View>
      )}
      {pendulum && card && card.code && !card.faceDown && (
        <View
          style={[
            styles.scaleBadge,
            pendulum === 'left' ? { left: 2 } : { right: 2 },
          ]}
        >
          <Text style={styles.scaleBadgeTxt}>P</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * ExtraMonsterZones — les 2 EMZ partagées entre les deux joueurs, rendues
 * une seule fois entre les deux camps. Chaque EMZ peut appartenir à l'un ou
 * l'autre joueur (moteur : `monsters[5]` et `monsters[6]` sur le propriétaire).
 */
function ExtraMonsterZones({
  meSide,
  foeSide,
  mySeat,
  promptOptions,
  onCardTap,
  onCardMenu,
  onOptionPicked,
  styles,
}: {
  meSide: DuelSideView;
  foeSide: DuelSideView;
  mySeat: DuelSeat;
  promptOptions: DuelPromptOption[];
  onCardTap: (c: DuelCardView) => void;
  onCardMenu: (c: DuelCardView, opts: DuelPromptOption[]) => void;
  onOptionPicked: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const foeSeat: DuelSeat = mySeat === 0 ? 1 : 0;
  const zones: Array<{ card: DuelCardView | null; owner: DuelSeat; sequence: number }> = [
    {
      card: meSide.monsters[5] ?? foeSide.monsters[5] ?? null,
      owner: meSide.monsters[5] ? mySeat : foeSeat,
      sequence: 5,
    },
    {
      card: meSide.monsters[6] ?? foeSide.monsters[6] ?? null,
      owner: meSide.monsters[6] ? mySeat : foeSeat,
      sequence: 6,
    },
  ];
  return (
    <View style={styles.emzRow}>
      {zones.map((z, i) => {
        const here = promptOptions.filter(
          (o) => o.location === LOCATION_MZONE && o.sequence === z.sequence
        );
        const place = here.find((o) => o.code === undefined);
        const targets = here.filter((o) => o.code !== undefined);
        return (
          <ZoneSlot
            key={`emz${i}`}
            card={z.card}
            placeable={!!place}
            actionable={targets.length > 0}
            emz
            onPress={() => {
              if (place) return onOptionPicked(place.id);
              if (targets.length && z.card) return onCardMenu(z.card, targets);
              if (z.card) return onCardTap(z.card);
            }}
            styles={styles}
          />
        );
      })}
    </View>
  );
}

// ─── ChainPanel — miroir mobile du web §5.2 gap n°8 ─────────────────────────

function ChainPanelMobile({
  chain,
  solvingLink,
  mySeat,
  styles,
}: {
  chain: import('@/types').DuelChainEntry[];
  solvingLink: number | null;
  mySeat: DuelSeat;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.chainPanel}>
      <Text style={styles.chainTitle}>Chaîne · {chain.length}</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {chain.map((link) => {
          const solving = solvingLink === link.link;
          const mine = link.controller === mySeat;
          return (
            <View
              key={`chain-${link.link}`}
              style={[styles.chainLink, solving && styles.chainLinkSolving]}
            >
              {link.code ? (
                <Image
                  source={{ uri: cardImg(link.code) }}
                  style={{ width: 30, height: 44 }}
                />
              ) : null}
              <Text style={styles.chainLinkTxt}>
                #{link.link} {mine ? 'moi' : 'adv.'}
              </Text>
              <Text style={styles.chainLinkTxt} numberOfLines={1}>
                {link.name ?? `#${link.code}`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── CardActionMenu (§4bis) ──────────────────────────────────────────────────

function CardActionMenu({
  menu,
  busy,
  onPick,
  onValidate,
  onCancel,
  styles,
  colors,
}: {
  menu: { title: string; card: DuelCardView | null; options: DuelPromptOption[]; pickedId: string | null };
  busy: boolean;
  onPick: (id: string) => void;
  onValidate: () => void;
  onCancel: () => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={[styles.modalTitle, { color: colors.gold }]}>{menu.title}</Text>
          <Text style={styles.dim}>
            L'adversaire ne voit rien tant que tu n'as pas cliqué Valider.
          </Text>
          <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
            <View style={{ gap: 8 }}>
              {menu.options.map((o) => {
                const picked = menu.pickedId === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.actionRow, picked && { backgroundColor: colors.gold }]}
                    onPress={() => onPick(o.id)}
                    disabled={busy}
                  >
                    <Text style={[styles.actionTxt, picked && { color: colors.onGold }]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.btn, !menu.pickedId && { opacity: 0.5 }]}
              onPress={onValidate}
              disabled={busy || !menu.pickedId}
            >
              <Text style={styles.btnTxt}>Valider</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={onCancel} disabled={busy}>
              <Text style={styles.ghostTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── PromptModal (cartes / options / chain / etc.) ───────────────────────────

function PromptModal({
  prompt,
  onChoose,
  busy,
  styles,
  colors,
}: {
  prompt: DuelPrompt;
  onChoose: (ids: string[], cancel?: boolean) => void;
  busy: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [prompt.message]);

  const canValidate = picked.length >= prompt.min && picked.length <= prompt.max;
  const isSingle = prompt.min === 1 && prompt.max === 1;

  // §C.2 · Indication de portée
  const rangeText =
    prompt.kind === 'cards' || prompt.kind === 'sort'
      ? prompt.min === prompt.max
        ? `Sélectionne exactement ${prompt.min} cible${prompt.min > 1 ? 's' : ''}`
        : `Sélectionne entre ${prompt.min} et ${prompt.max} cibles`
      : null;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 360 }]}>
          <Text style={[styles.modalTitle, { color: colors.gold }]}>
            {prompt.hint?.title ?? prompt.message}
          </Text>
          {rangeText && (
            <Text style={[styles.dim, { color: colors.gold }]}>{rangeText}</Text>
          )}
          {prompt.hint?.note && (
            <Text style={[styles.dim, { color: colors.cyan }]}>{prompt.hint.note}</Text>
          )}
          {prompt.max > 1 && (
            <Text style={styles.dim}>
              {picked.length} / {prompt.min === prompt.max ? prompt.min : `${prompt.min}–${prompt.max}`}
            </Text>
          )}
          <ScrollView style={{ maxHeight: 340, marginVertical: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {prompt.options.map((opt) => {
                const on = picked.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.optBtn,
                      { minWidth: 90, maxWidth: 100 },
                      on && { backgroundColor: colors.gold },
                    ]}
                    onPress={() => {
                      if (isSingle) {
                        onChoose([opt.id]);
                      } else if (on) {
                        setPicked(picked.filter((p) => p !== opt.id));
                      } else if (picked.length < prompt.max) {
                        setPicked([...picked, opt.id]);
                      }
                    }}
                    disabled={busy}
                  >
                    {opt.code ? (
                      <Image
                        source={{ uri: cardImg(opt.code) }}
                        style={{ width: 60, height: 88 }}
                      />
                    ) : null}
                    <Text style={[styles.optLbl, on && { color: colors.onGold }]} numberOfLines={2}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {!isSingle && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.btn, !canValidate && { opacity: 0.5 }]}
                disabled={!canValidate || busy}
                onPress={() => onChoose(picked)}
              >
                <Text style={styles.btnTxt}>Valider</Text>
              </TouchableOpacity>
              {prompt.canCancel && (
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => onChoose([], true)}
                  disabled={busy}
                >
                  <Text style={styles.ghostTxt}>{prompt.kind === 'chain' ? 'Ne pas répondre' : 'Passer'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── PhaseActionsBar (main/battle non-carte) ─────────────────────────────────

function PhaseActionsBar({
  prompt,
  onChoose,
  busy,
  styles,
}: {
  prompt: DuelPrompt;
  onChoose: (id: string) => void;
  busy: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const phaseOptions = prompt.options.filter((o) => o.code === undefined);
  if (phaseOptions.length === 0) return null;
  return (
    <View style={styles.prompt}>
      <Text style={styles.promptTitle}>Actions</Text>
      <ScrollView horizontal contentContainerStyle={{ gap: 6, padding: 4 }}>
        {phaseOptions.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={styles.optBtn}
            onPress={() => onChoose(o.id)}
            disabled={busy}
          >
            <Text style={styles.optLbl}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── ZoneModal (Extra / Cimetière / Bannies — mine ou adverse §C.4) ─────────

function ZoneModal({
  zone,
  side,
  onClose,
  onCardTap,
  styles,
  colors,
}: {
  zone: { kind: 'extra' | 'grave' | 'banished'; side: 'me' | 'foe' };
  side: DuelSideView;
  onClose: () => void;
  onCardTap: (c: DuelCardView) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const cards =
    zone.kind === 'grave' ? side.graveyard : zone.kind === 'banished' ? side.banished : [];
  const label =
    zone.kind === 'extra' ? 'Extra Deck' : zone.kind === 'grave' ? 'Cimetière' : 'Bannies';
  const emptyMsg =
    zone.kind === 'extra'
      ? `${side.extraCount} carte(s) — contenu masqué tant qu'elles ne sont pas révélées.`
      : 'Zone vide.';

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={[styles.modalTitle, { color: colors.cyan }]}>
            {zone.side === 'foe' ? 'Adversaire · ' : ''}
            {label}
          </Text>
          {cards.length === 0 ? (
            <Text style={styles.dim}>{emptyMsg}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {cards.map((c, i) => (
                  <TouchableOpacity
                    key={`${c.code}-${i}`}
                    onPress={() => onCardTap(c)}
                    style={{ width: 68, height: 96 }}
                  >
                    {c.code ? (
                      <Image
                        source={{ uri: cardImg(c.code) }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.dim}>?</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
            <Text style={styles.ghostTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── ConfirmEndTurnModal (§C.3) ──────────────────────────────────────────────

function ConfirmEndTurnModal({
  hand,
  phase,
  muted,
  onMute,
  onConfirm,
  onCancel,
  busy,
  styles,
  colors,
}: {
  hand: number;
  phase: string;
  muted: boolean;
  onMute: (b: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const reason =
    phase === 'main1' && hand > 0
      ? `Il te reste ${hand} carte(s) en main.`
      : "Certains de tes monstres n'ont pas encore attaqué.";
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.modalOverlay} onPress={onCancel} activeOpacity={1}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={[styles.modalTitle, { color: colors.gold }]}>Terminer ton tour ?</Text>
          <Text style={styles.dim}>{reason}</Text>
          <TouchableOpacity
            onPress={() => onMute(!muted)}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginVertical: 12 }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: muted ? colors.gold : 'transparent',
              }}
            />
            <Text style={styles.dim}>Ne plus demander cette partie</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.btn} onPress={onConfirm} disabled={busy}>
              <Text style={styles.btnTxt}>Confirmer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={onCancel}>
              <Text style={styles.ghostTxt}>Non, je continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── CounterModal (SELECT_COUNTER) ───────────────────────────────────────────

function CounterModal({
  prompt,
  busy,
  onConfirm,
  styles,
  colors,
}: {
  prompt: DuelPrompt;
  busy: boolean;
  onConfirm: (counters: Array<{ targetIdx: number; take: number }>) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const c = prompt.counter!;
  const [values, setValues] = useState<number[]>(() => c.targets.map(() => 0));
  const total = values.reduce((s, v) => s + v, 0);
  const enough = total === c.count;

  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={[styles.modalTitle, { color: colors.gold }]}>{prompt.message}</Text>
          <Text style={styles.dim}>
            Type : {c.counterName} · à retirer : {c.count} (choisi : {total})
          </Text>
          <ScrollView style={{ maxHeight: 300, marginVertical: 12 }}>
            {c.targets.map((t, i) => (
              <View key={`${t.cardCode}-${i}`} style={styles.counterRow}>
                <Text style={styles.actionTxt}>
                  {t.cardName} <Text style={styles.dim}>({t.currentCount})</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => setValues((cur) => cur.map((x, k) => (k === i ? Math.max(0, x - 1) : x)))}
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.actionTxt, { minWidth: 24, textAlign: 'center' }]}>
                    {values[i]}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setValues((cur) => cur.map((x, k) => (k === i ? Math.min(t.currentCount, x + 1) : x)))
                    }
                    style={styles.counterBtn}
                  >
                    <Text style={styles.counterBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.btn, !enough && { opacity: 0.5 }]}
            disabled={!enough || busy}
            onPress={() =>
              onConfirm(
                values
                  .map((take, targetIdx) => ({ targetIdx, take }))
                  .filter((x) => x.take > 0)
              )
            }
          >
            <Text style={styles.btnTxt}>
              {enough ? 'Retirer' : `Encore ${c.count - total} à choisir`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── AnnounceCardModal (typeahead) ──────────────────────────────────────────

function AnnounceCardModal({
  duelId,
  busy,
  onConfirm,
  styles,
  colors,
}: {
  duelId: number;
  busy: boolean;
  onConfirm: (code: number) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DuelAnnounceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      duelEngineApi
        .announceSearch(duelId, q)
        .then((rs) => setResults(rs))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, duelId]);

  return (
    <Modal transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { minWidth: 320 }]}>
          <Text style={[styles.modalTitle, { color: colors.gold }]}>Déclare une carte</Text>
          <Text style={styles.dim}>
            Tape le début du nom. Seules les cartes que le moteur accepte sont proposées.
          </Text>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Nom de la carte…"
            placeholderTextColor={colors.textDim}
            maxLength={64}
            style={styles.textInput}
          />
          <ScrollView style={{ maxHeight: 300, marginTop: 8 }}>
            {searching && <Text style={styles.dim}>Recherche…</Text>}
            {!searching && query.trim().length < 2 && (
              <Text style={styles.dim}>Deux caractères minimum.</Text>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <Text style={styles.dim}>Aucune carte ne correspond ET ne passe le filtre.</Text>
            )}
            {results.map((r) => (
              <TouchableOpacity
                key={r.code}
                style={styles.actionRow}
                onPress={() => onConfirm(r.code)}
                disabled={busy}
              >
                <Image source={{ uri: cardImg(r.code) }} style={{ width: 32, height: 46 }} />
                <Text style={[styles.actionTxt, { flex: 1, marginLeft: 8 }]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── JournalPanel (§C.1) ────────────────────────────────────────────────────

function JournalPanel({
  log,
  tab,
  onTab,
  styles,
  colors,
}: {
  log: DuelLogEntry[];
  tab: 'actions' | 'flow';
  onTab: (t: 'actions' | 'flow') => void;
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const filtered = log.filter((e) => categorizeLog(e) === tab);
  return (
    <View style={styles.panel}>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
        <TouchableOpacity
          style={[styles.tab, tab === 'actions' && { backgroundColor: colors.gold, borderColor: colors.gold }]}
          onPress={() => onTab('actions')}
        >
          <Text style={[styles.tabTxt, tab === 'actions' && { color: colors.onGold }]}>Actions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'flow' && { backgroundColor: colors.violet, borderColor: colors.violet }]}
          onPress={() => onTab('flow')}
        >
          <Text style={[styles.tabTxt, tab === 'flow' && { color: colors.onGold }]}>Déroulé</Text>
        </TouchableOpacity>
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.dim}>{tab === 'actions' ? 'Aucune action encore.' : 'Rien encore.'}</Text>
      ) : (
        [...filtered].reverse().slice(0, 12).map((entry, i) => (
          <Text key={i} style={styles.logLine}>
            <Text style={{ color: tab === 'actions' ? colors.gold : colors.violet }}>› </Text>
            {entry.text}
          </Text>
        ))
      )}
    </View>
  );
}

// ─── RevealOverlay ──────────────────────────────────────────────────────────

function RevealOverlay({
  reveals,
  styles,
  colors,
}: {
  reveals: DuelRevealBatch[];
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const [alive, setAlive] = useState<DuelRevealBatch[]>([]);
  useEffect(() => {
    setAlive((prev) => {
      const seen = new Set(prev.map((r) => `${r.at}:${r.forPlayer}`));
      return [...prev, ...reveals.filter((r) => !seen.has(`${r.at}:${r.forPlayer}`))];
    });
  }, [reveals]);
  useEffect(() => {
    if (!alive.length) return;
    const t = setTimeout(
      () => setAlive((prev) => prev.filter((r) => Date.now() - r.at < r.ttl)),
      600
    );
    return () => clearTimeout(t);
  }, [alive]);

  if (alive.length === 0) return null;

  return (
    <View style={styles.revealOverlay} pointerEvents="none">
      {alive.map((batch) => (
        <View key={`${batch.at}:${batch.forPlayer}`} style={styles.revealBox}>
          <Text style={styles.revealLabel}>Révélation</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 6 }} showsHorizontalScrollIndicator={false}>
            {batch.cards.map((card, i) => (
              <View key={`${card.code}-${i}`} style={{ alignItems: 'center', gap: 4 }}>
                <Image source={{ uri: cardImg(card.code) }} style={{ width: 60, height: 88 }} />
                <Text style={[styles.dim, { color: colors.cyan, fontSize: 8 }]}>
                  {card.from === 'decktop' ? 'Deck (dessus)' : card.from === 'extratop' ? 'Extra (dessus)' : card.from}
                </Text>
                <Text style={[styles.dim, { fontSize: 8, maxWidth: 60 }]} numberOfLines={2}>
                  {card.name ?? `#${card.code}`}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

// ─── TossOverlay ────────────────────────────────────────────────────────────

function TossOverlay({
  tosses,
  styles,
  colors,
}: {
  tosses: DuelTossEvent[];
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const [alive, setAlive] = useState<DuelTossEvent[]>([]);
  useEffect(() => {
    setAlive((prev) => {
      const seen = new Set(prev.map((t) => `${t.at}:${t.kind}`));
      return [...prev, ...tosses.filter((t) => !seen.has(`${t.at}:${t.kind}`))];
    });
  }, [tosses]);
  useEffect(() => {
    if (!alive.length) return;
    const t = setTimeout(() => setAlive((prev) => prev.filter((x) => Date.now() - x.at < x.ttl)), 600);
    return () => clearTimeout(t);
  }, [alive]);

  if (!alive.length) return null;
  return (
    <View style={styles.tossOverlay} pointerEvents="none">
      {alive.map((toss) => (
        <View key={`${toss.at}:${toss.kind}`} style={styles.tossBox}>
          <Text style={{ fontSize: 34 }}>{toss.kind === 'coin' ? '🪙' : '🎲'}</Text>
          <Text style={[styles.dim, { color: colors.gold, fontSize: 9 }]}>
            {toss.kind === 'coin' ? 'Pile ou face' : 'Lancer de dés'}
          </Text>
          <Text style={{ color: colors.cyan, fontSize: 18, fontWeight: '700' }}>
            {toss.kind === 'coin'
              ? toss.results.map((r) => (r ? 'FACE' : 'PILE')).join(' · ')
              : toss.results.join(' · ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── AnimationLayer (§3.2) + DrawAnimation ──────────────────────────────────

function animationAccent(kind: string, variant?: string, colors?: Theme['colors']): string {
  const c = colors!;
  if (kind === 'spsummoned') {
    if (variant === 'xyz') return c.cyan;
    if (variant === 'link') return c.violet;
    if (variant === 'synchro') return c.gold;
    if (variant === 'fusion') return c.magenta;
    return c.gold;
  }
  if (kind === 'become_target' || kind === 'card_target') return c.danger;
  if (kind === 'chained' || kind === 'chain_solving' || kind === 'chain_solved' || kind === 'chain_end') return c.magenta;
  if (kind === 'shuffle_hand' || kind === 'shuffle_deck' || kind === 'shuffle_extra') return c.cyan;
  return c.textMuted;
}

function animationGlyph(kind: string, variant?: string): string {
  if (kind === 'spsummoned') {
    if (variant === 'xyz') return '◈';
    if (variant === 'link') return '◇';
    if (variant === 'synchro') return '☼';
    if (variant === 'fusion') return '✧';
    return '★';
  }
  if (kind === 'summoned') return '✦';
  if (kind === 'flipsummoned') return '⟳';
  if (kind === 'move' || kind === 'swap') return '⇄';
  if (kind === 'pos_change') return '⇅';
  if (kind === 'equip') return '⚔';
  if (kind === 'shuffle_hand' || kind === 'shuffle_deck' || kind === 'shuffle_extra') return '⌥';
  if (kind === 'deck_top') return '↑';
  if (kind === 'add_counter') return '＋';
  if (kind === 'remove_counter') return '−';
  if (kind === 'become_target' || kind === 'card_target') return '◎';
  if (kind === 'chained') return '⛓';
  if (kind === 'chain_solving' || kind === 'chain_solved') return '≈';
  if (kind === 'chain_end') return '∎';
  return '·';
}

function AnimationLayer({
  animations,
  styles,
  colors,
}: {
  animations: DuelAnimationEvent[];
  styles: ReturnType<typeof makeStyles>;
  colors: Theme['colors'];
}) {
  const [alive, setAlive] = useState<DuelAnimationEvent[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const additions: DuelAnimationEvent[] = [];
    for (const a of animations) {
      const k = `${a.at}:${a.kind}:${a.description}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      additions.push(a);
    }
    if (additions.length) setAlive((prev) => [...prev, ...additions]);
  }, [animations]);

  useEffect(() => {
    if (!alive.length) return;
    const t = setInterval(() => {
      const now = Date.now();
      setAlive((prev) => prev.filter((a) => now - a.at < a.ttl));
    }, 400);
    return () => clearInterval(t);
  }, [alive]);

  const drawEvents = alive.filter((a) => a.kind === 'draw' && (a.count ?? 0) > 0);
  const otherEvents = alive.filter((a) => a.kind !== 'draw');

  return (
    <>
      {otherEvents.length > 0 && (
        <View style={styles.animLayer} pointerEvents="none">
          {otherEvents.slice(-6).map((a) => {
            const accent = animationAccent(a.kind, a.variant, colors);
            return (
              <View
                key={`${a.at}:${a.kind}:${a.description}`}
                style={[styles.animLine, { borderColor: accent }]}
              >
                <Text style={{ color: accent, fontSize: 10 }}>
                  {animationGlyph(a.kind, a.variant)} {a.description}
                </Text>
              </View>
            );
          })}
        </View>
      )}
      {/* Draw animation — cartes stagger 80ms (RN : opacity + translateX simplifié) */}
      {drawEvents.map((a) => (
        <DrawAnimation key={`draw:${a.at}:${a.controller}`} event={a} colors={colors} />
      ))}
    </>
  );
}

function DrawAnimation({ event, colors }: { event: DuelAnimationEvent; colors: Theme['colors'] }) {
  const count = event.count ?? 0;
  const codes = event.codes ?? [];
  const [opacity] = useState(0.9);
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: '45%',
        left: 0,
        right: 0,
        alignItems: 'center',
        opacity,
      }}
      pointerEvents="none"
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 48,
              height: 68,
              borderWidth: 1,
              borderColor: colors.violet,
              backgroundColor: codes[i] ? undefined : colors.panel2,
            }}
          >
            {codes[i] !== undefined && (
              <Image source={{ uri: cardImg(codes[i]) }} style={{ width: '100%', height: '100%' }} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    loader: {
      flex: 1,
      backgroundColor: t.colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    title: { fontSize: 14, fontWeight: '700', color: t.colors.text },
    subtitle: { fontSize: 11, color: t.colors.textDim },
    btn: {
      backgroundColor: t.colors.gold,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 4,
      alignItems: 'center',
    },
    btnTxt: {
      color: t.colors.onGold,
      fontWeight: '700',
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    ghostBtn: {
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 4,
    },
    ghostTxt: { color: t.colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
    dangerBtn: {
      backgroundColor: 'transparent',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.danger,
      marginLeft: 6,
    },
    dangerTxt: { color: t.colors.danger, fontSize: 10, fontWeight: '600' },
    dim: { color: t.colors.textDim, fontSize: 12 },
    clockPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: t.colors.panel,
      minWidth: 52,
      alignItems: 'center',
    },
    clockPillActive: { borderWidth: 1, borderColor: t.colors.gold },
    clockTxt: { fontSize: 9, color: t.colors.textDim },
    clockValue: { fontSize: 12, color: t.colors.text, fontWeight: '700' },
    boardSide: { paddingHorizontal: 6, paddingVertical: 4, marginBottom: 2 },
    boardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    boardLabel: { color: t.colors.text, fontWeight: '700', fontSize: 11 },
    boardRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    zoneStack: { flex: 1, gap: 3 },
    zoneRow: { flexDirection: 'row', gap: 3 },
    sideCol: { width: 46, gap: 3 },
    zone: {
      width: 44,
      aspectRatio: 0.7,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 3,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.panel,
      position: 'relative',
    },
    zoneCover: { color: t.colors.textDim, fontSize: 8 },
    emzRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 24,
      paddingVertical: 3,
      backgroundColor: 'rgba(34,211,238,0.04)',
    },
    pileRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
    pile: {
      flex: 1,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 4,
      paddingVertical: 6,
      alignItems: 'center',
    },
    pileSmall: {
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 3,
      paddingVertical: 4,
      alignItems: 'center',
      minHeight: 30,
    },
    pileLabel: { color: t.colors.textDim, fontSize: 8, letterSpacing: 0.5 },
    pileValue: { color: t.colors.text, fontSize: 12, fontWeight: '700' },
    counterBadge: {
      position: 'absolute',
      bottom: -6,
      right: -6,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: t.colors.gold,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
      zIndex: 3,
    },
    counterBadgeTxt: { color: t.colors.onGold, fontSize: 9, fontWeight: '800' },
    materialBadge: {
      position: 'absolute',
      top: -4,
      left: -4,
      minWidth: 16,
      height: 14,
      borderRadius: 3,
      backgroundColor: t.colors.cyan,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 3,
      zIndex: 3,
    },
    materialBadgeTxt: { color: '#0a1a1f', fontSize: 8, fontWeight: '800' },
    scaleBadge: {
      position: 'absolute',
      top: 1,
      backgroundColor: 'rgba(139,92,246,0.9)',
      paddingHorizontal: 3,
      paddingVertical: 1,
      borderRadius: 2,
      zIndex: 4,
    },
    scaleBadgeTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
    chainPanel: {
      marginHorizontal: 6,
      marginTop: 4,
      padding: 6,
      borderWidth: 1,
      borderColor: t.colors.magenta,
      borderRadius: 4,
      backgroundColor: 'rgba(184,46,133,0.08)',
    },
    chainTitle: {
      color: t.colors.magenta,
      fontSize: 9,
      letterSpacing: 1,
      fontWeight: '800',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    chainLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 3,
      backgroundColor: t.colors.panel2,
      maxWidth: 140,
    },
    chainLinkSolving: {
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(245,197,24,0.18)',
    },
    chainLinkTxt: { color: t.colors.text, fontSize: 9 },
    lpRow: {
      flexDirection: 'row',
      gap: 24,
      justifyContent: 'center',
      marginTop: 8,
      marginBottom: 6,
    },
    lpBox: { alignItems: 'center' },
    lpLabel: { color: t.colors.textDim, fontSize: 9, letterSpacing: 1 },
    lpValue: { color: t.colors.text, fontSize: 22, fontWeight: '700' },
    hintBanner: {
      marginHorizontal: 8,
      padding: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel2,
      alignItems: 'center',
    },
    hintTxt: { color: t.colors.textMuted, fontSize: 12, textAlign: 'center' },
    panel: {
      marginHorizontal: 8,
      marginTop: 6,
      padding: 10,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    panelTitle: { color: t.colors.text, fontWeight: '700', marginBottom: 4, fontSize: 12 },
    logLine: { color: t.colors.textMuted, fontSize: 11, marginVertical: 1 },
    tab: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 3,
    },
    tabTxt: {
      color: t.colors.textDim,
      fontSize: 9,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    handBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 110,
      backgroundColor: t.colors.panel,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    handCard: { width: 66, height: 96, borderRadius: 4, overflow: 'hidden' },
    handImg: { width: '100%', height: '100%' },
    prompt: {
      position: 'absolute',
      bottom: 116,
      left: 8,
      right: 8,
      backgroundColor: t.colors.panel,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.gold,
      padding: 10,
      maxHeight: 220,
    },
    promptTitle: { color: t.colors.text, fontWeight: '700', marginBottom: 4 },
    optBtn: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 4,
      padding: 4,
      minWidth: 70,
      maxWidth: 120,
      alignItems: 'center',
    },
    optLbl: { fontSize: 10, color: t.colors.text, marginTop: 4, textAlign: 'center' },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 4,
      backgroundColor: t.colors.panel2,
    },
    actionTxt: { color: t.colors.text, fontSize: 13 },
    counterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    counterBtn: {
      width: 30,
      height: 30,
      backgroundColor: t.colors.panel2,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterBtnTxt: { color: t.colors.text, fontSize: 16, fontWeight: '700' },
    textInput: {
      backgroundColor: t.colors.bgElev,
      color: t.colors.text,
      borderWidth: 1,
      borderColor: t.colors.border,
      padding: 8,
      borderRadius: 4,
      marginTop: 8,
    },
    revealOverlay: {
      position: 'absolute',
      top: 100,
      left: 8,
      right: 8,
      zIndex: 800,
    },
    revealBox: {
      backgroundColor: 'rgba(11,9,6,0.9)',
      borderWidth: 1,
      borderColor: t.colors.gold,
      padding: 8,
      marginBottom: 6,
    },
    revealLabel: {
      color: t.colors.gold,
      fontSize: 9,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    tossOverlay: {
      position: 'absolute',
      top: '35%',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 900,
    },
    tossBox: {
      backgroundColor: 'rgba(11,9,6,0.9)',
      borderWidth: 2,
      borderColor: t.colors.gold,
      padding: 16,
      alignItems: 'center',
      gap: 4,
    },
    animLayer: {
      position: 'absolute',
      top: 100,
      right: 8,
      maxWidth: 200,
      zIndex: 700,
    },
    animLine: {
      backgroundColor: 'rgba(11,9,6,0.85)',
      borderWidth: 1,
      paddingHorizontal: 6,
      paddingVertical: 3,
      marginBottom: 3,
    },
    retryToast: {
      position: 'absolute',
      top: 90,
      left: 24,
      right: 24,
      backgroundColor: 'rgba(11,9,6,0.95)',
      borderWidth: 2,
      borderColor: t.colors.danger,
      padding: 12,
      alignItems: 'center',
      zIndex: 1000,
    },
    retryTxt: { color: t.colors.danger, fontWeight: '700', fontSize: 13 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      backgroundColor: t.colors.panel,
      borderRadius: 8,
      padding: 14,
      maxWidth: 340,
      width: '100%',
      alignItems: 'stretch',
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    modalImg: { width: 240, height: 350, alignSelf: 'center' },
    modalTitle: { fontSize: 14, fontWeight: '700', color: t.colors.text, marginBottom: 4 },
    modalDesc: { color: t.colors.textMuted, fontSize: 12, marginTop: 8 },
  });
