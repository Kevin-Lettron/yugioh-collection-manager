import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import duelEngineApi from '@/services/duelEngineApi';
import socketService from '@/services/socket';
import type { DuelCardView, DuelSideView, DuelStateResponse } from '@/types';

/**
 * F7 · Spectateur mobile — miroir portrait de `client/src/pages/DuelSpectate.tsx`.
 *
 * Lecture seule stricte : aucune main détaillée, aucun prompt, aucune
 * interaction sur les cartes. La vue provient de l'endpoint dédié
 * `GET /duels/:id/engine/spectate` qui filtre déjà les événements privés
 * (SHUFFLE_HAND, DECK_TOP, DRAW avec codes) côté serveur — on peut donc
 * afficher le snapshot tel quel sans revalider.
 *
 * Temps réel via socket (Bloc 5) + poll de secours toutes les 5 s.
 */
const cardImg = (code: number): string =>
  `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`;

export default function DuelSpectateScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = Number(id);
  const router = useRouter();

  const [state, setState] = useState<DuelStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(duelId)) return;
    try {
      const s = await duelEngineApi.spectate(duelId);
      setState(s);
      setError(null);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 403
          ? "Tu dois suivre au moins un des deux joueurs pour regarder ce duel."
          : err?.response?.data?.error?.message ?? "Duel non disponible.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [duelId]);

  useEffect(() => {
    load();
  }, [load]);

  // Verrou landscape à l'entrée — miroir de l'arène moteur.
  useEffect(() => {
    (async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch {
        /* dégradé accepté */
      }
    })();
    return () => {
      ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, []);

  // Socket : refresh sur `duel:engine_update`, join la room.
  useEffect(() => {
    if (!Number.isFinite(duelId)) return undefined;
    let attached: ReturnType<typeof socketService.getSocket> = null;
    let cancelled = false;

    const onUpdate = (data: { duelId: number }) => {
      if (data?.duelId === duelId) load();
    };

    void socketService.connect().then((socket) => {
      if (cancelled || !socket) return;
      attached = socket;
      socket.emit('duel:join', { duelId });
      socket.on('duel:engine_update', onUpdate);
    });

    // Poll de secours 5 s — plus lent que l'arène active (le spectateur n'a
    // pas besoin de latence inférieure à 5 s).
    const poll = setInterval(load, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (!attached) return;
      attached.off('duel:engine_update', onUpdate);
      attached.emit('duel:leave', { duelId });
    };
  }, [duelId, load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <AppBackground />
        <ActivityIndicator size="large" color={colors.gold} />
      </SafeAreaView>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.loader}>
        <AppBackground />
        <CornerOrnaments />
        <Text style={styles.errTitle}>Impossible de regarder ce duel</Text>
        <Text style={styles.dim}>{error}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnTxt}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (!state) return null;

  const { board, log, combatLog } = state;

  return (
    <SafeAreaView style={styles.container}>
      <AppBackground />
      <CornerOrnaments />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Spectateur · Duel #{duelId}</Text>
          <Text style={styles.subtitle}>
            Tour {board.turn} · {board.phase}
          </Text>
        </View>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => router.back()}>
          <Text style={styles.ghostTxt}>Quitter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 8, gap: 6 }}>
        {/* Plateau adverse (haut) — sans main détaillée */}
        <SpectatorBoard side={board.opponent} label="Joueur 2" styles={styles} />
        {/* Plateau joueur (bas) */}
        <SpectatorBoard side={board.me} label="Joueur 1" styles={styles} />

        <View style={styles.lpRow}>
          <View style={styles.lpBox}>
            <Text style={styles.lpLabel}>J2</Text>
            <Text style={styles.lpValue}>{board.opponent.lp}</Text>
          </View>
          <View style={styles.lpBox}>
            <Text style={[styles.lpLabel, { color: colors.gold }]}>J1</Text>
            <Text style={[styles.lpValue, { color: colors.gold }]}>{board.me.lp}</Text>
          </View>
        </View>

        {/* Journal */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Déroulé</Text>
          {log.slice(-12).map((l, i) => (
            <Text key={i} style={styles.logLine}>
              · {l.text}
            </Text>
          ))}
        </View>

        {combatLog && combatLog.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Combat</Text>
            {combatLog.slice(-8).map((c, i) => (
              <Text key={i} style={styles.logLine}>
                › {c.description}
              </Text>
            ))}
          </View>
        )}

        {state.status === 'ended' && (
          <View style={[styles.panel, { borderColor: colors.gold, backgroundColor: 'rgba(212,160,23,0.15)' }]}>
            <Text style={[styles.panelTitle, { color: colors.gold }]}>Fin du duel</Text>
            <Text style={styles.dim}>
              Vainqueur : Joueur{' '}
              {state.winner !== null && state.winner !== undefined ? state.winner + 1 : '?'}
              {state.winReason ? ` (${state.winReason})` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SpectatorBoard({
  side,
  label,
  styles,
}: {
  side: DuelSideView;
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.boardSide}>
      <View style={styles.boardHeader}>
        <Text style={styles.boardLabel}>{label}</Text>
        <Text style={styles.dim}>
          {side.lp} LP · Main {side.handCount} · Deck {side.deckCount}
        </Text>
      </View>
      <View style={styles.zoneRow}>
        {side.monsters.slice(0, 5).map((z, i) => (
          <Slot key={`m${i}`} zone={z} styles={styles} />
        ))}
      </View>
      <View style={styles.zoneRow}>
        {side.spells.slice(0, 5).map((z, i) => (
          <Slot key={`s${i}`} zone={z} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function Slot({
  zone,
  styles,
}: {
  zone: DuelCardView | null;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (!zone) return <View style={styles.zone} />;
  return (
    <View style={styles.zone}>
      {zone.code && !zone.faceDown ? (
        <Image source={{ uri: cardImg(zone.code) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <Text style={styles.zoneCover}>{zone.faceDown ? 'Verso' : '?'}</Text>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.bg },
    loader: {
      flex: 1,
      backgroundColor: t.colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      padding: 24,
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
    errTitle: { color: t.colors.danger, fontSize: 16, fontWeight: '700', textAlign: 'center' },
    dim: { color: t.colors.textDim, fontSize: 12, textAlign: 'center' },
    btn: {
      backgroundColor: t.colors.gold,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 4,
    },
    btnTxt: { color: t.colors.onGold, fontWeight: '700', fontSize: 12 },
    ghostBtn: {
      borderWidth: 1,
      borderColor: t.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
    },
    ghostTxt: { color: t.colors.textMuted, fontSize: 11 },
    boardSide: {
      padding: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 4,
      backgroundColor: t.colors.panel,
    },
    boardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    boardLabel: { color: t.colors.text, fontWeight: '700', fontSize: 12 },
    zoneRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
    zone: {
      flex: 1,
      aspectRatio: 0.7,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.colors.panel2,
    },
    zoneCover: { color: t.colors.textDim, fontSize: 9 },
    lpRow: { flexDirection: 'row', gap: 24, justifyContent: 'center', marginVertical: 8 },
    lpBox: { alignItems: 'center' },
    lpLabel: { color: t.colors.textDim, fontSize: 9, letterSpacing: 1 },
    lpValue: { color: t.colors.text, fontSize: 22, fontWeight: '700' },
    panel: {
      padding: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
    },
    panelTitle: { color: t.colors.text, fontWeight: '700', marginBottom: 4, fontSize: 12 },
    logLine: { color: t.colors.textMuted, fontSize: 11, marginVertical: 1 },
  });
