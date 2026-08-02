import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { deckApi } from '@/services/deckApi';
import { duelApi } from '@/services/duelApi';
import type { Deck } from '@/types';
import CyberButton from '@/components/CyberButton';

interface Props {
  visible: boolean;
  targetUsername: string;
  targetUserId?: number;
  onClose: () => void;
  /** Optionnel: appele apres envoi du defi, avec l'id du duel cree. */
  onSent?: (duelId: number) => void;
}

/**
 * Modal « Envoyer un defi » — miroir mobile du popup web.
 *
 * L'utilisateur choisit un de ses decks (fetch via deckApi.listMine) puis
 * declenche duelApi.challenge({opponent_username, challenger_deck_id}).
 * A l'envoi reussi, on redirige vers l'ecran des duels (tab) : le duel est
 * en `pending` tant que l'adversaire ne l'accepte pas.
 */
export default function ChallengeModal({
  visible,
  targetUsername,
  targetUserId,
  onClose,
  onSent,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();

  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await deckApi.listMine();
      setDecks(list);
      // Selection auto du 1er deck pour eviter un « rien selectionne » silencieux.
      if (list.length > 0) setSelectedDeckId(list[0].id);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Impossible de charger tes decks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
    else {
      setSelectedDeckId(null);
      setDecks([]);
    }
  }, [visible, load]);

  const handleSend = async () => {
    if (!selectedDeckId || sending) return;
    setSending(true);
    try {
      const res = await duelApi.challenge({
        opponent_username: targetUsername,
        opponent_id: targetUserId,
        challenger_deck_id: selectedDeckId,
      });
      onClose();
      onSent?.(res.duel.id);
      // Par defaut on redirige vers l'onglet duels (le user va y voir son duel
      // en pending). Il pourra le suivre / l'annuler depuis la.
      router.push('/(tabs)/duels');
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || "Envoi du defi echoue");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.kicker}>— Duel —</Text>
            <Text style={styles.title}>Envoyer un defi</Text>
            <Text style={styles.sub}>
              Contre <Text style={{ color: colors.violet }}>@{targetUsername}</Text>
            </Text>
          </View>

          <View style={styles.divider} />

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.emptyText}>Chargement des decks…</Text>
            </View>
          ) : decks.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucun deck disponible. Cree un deck avant de defier.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 320 }}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {decks.map((d) => {
                const selected = d.id === selectedDeckId;
                const mainCount = d.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                const extraCount = d.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
                const cover =
                  d.cover_image ||
                  d.main_deck?.[0]?.card?.card_images?.[0]?.image_url_small;
                return (
                  <TouchableOpacity
                    key={d.id}
                    onPress={() => setSelectedDeckId(d.id)}
                    activeOpacity={0.85}
                    style={[
                      styles.deckRow,
                      selected && {
                        borderColor: colors.gold,
                        backgroundColor: 'rgba(245,197,24,0.08)',
                      },
                    ]}
                  >
                    <View style={styles.deckThumb}>
                      {cover ? (
                        <Image
                          source={{ uri: cover }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={styles.deckThumbFallback}>D</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.deckName} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={styles.deckMeta} numberOfLines={1}>
                        {mainCount} main · {extraCount} extra
                      </Text>
                    </View>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelBtn}
              disabled={sending}
            >
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <CyberButton
                label="Envoyer le defi"
                variant="primary"
                block
                cutColor={colors.panel}
                loading={sending}
                disabled={!selectedDeckId || decks.length === 0}
                onPress={handleSend}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    panel: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.violet,
      overflow: 'hidden',
    },
    header: {
      padding: 16,
      paddingBottom: 10,
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
      fontSize: 18,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      color: t.colors.text,
    },
    sub: {
      marginTop: 4,
      fontSize: 12,
      color: t.colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: t.colors.border,
    },
    center: {
      padding: 24,
      alignItems: 'center',
      gap: 10,
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    deckRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    deckThumb: {
      width: 40,
      height: 56,
      backgroundColor: t.colors.panel2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    deckThumbFallback: {
      fontFamily: 'sans-serif',
      fontWeight: '900',
      color: t.colors.textMuted,
      fontSize: 16,
    },
    deckName: {
      fontFamily: 'sans-serif',
      fontSize: 13,
      fontWeight: '700',
      color: t.colors.text,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    deckMeta: {
      marginTop: 3,
      fontSize: 11,
      color: t.colors.textMuted,
    },
    checkmark: {
      fontSize: 18,
      color: t.colors.gold,
      fontWeight: '900',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    cancelBtn: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    cancelText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
      fontWeight: '700',
    },
  });
