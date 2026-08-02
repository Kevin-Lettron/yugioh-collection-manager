import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { deckApi } from '@/services/deckApi';
import { collectionApi } from '@/services/collectionApi';
import type { Deck, DeckCard, UserCard } from '@/types';
import { API_URL } from '@/config';
import AddCardsFromCollectionModal from '@/components/AddCardsFromCollectionModal';
import AIBuilderModal from '@/components/AIBuilderModal';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';

const CARD_ICON = require('@/assets/images/decor/glyph-pyramid.png');
const SEARCH_ICON = require('@/assets/images/ui/i-search.png');

/**
 * DeckEditor — sc-if `isEditor` (PhoneFrame l.325-380).
 * Layout : header sticky avec kicker + titre + bouton "Auto IA" violet, row de 3
 * compteurs biseautés (Main gold, Extra violet, Side cyan), section "Deck principal"
 * en grid 6 cols de slots (filled = svg card icon, empty = dashed), et section
 * "Ma collection" en scroll horizontal de mini-cartes avec bouton "+" or au tap.
 */
export default function DeckEditorScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState<UserCard[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<'main' | 'extra' | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const d = await deckApi.get(deckId);
      setDeck(d);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Deck introuvable');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [deckId, router]);

  const loadPool = useCallback(async () => {
    setPoolLoading(true);
    try {
      const res = await collectionApi.list({ page: 1, limit: 20 });
      setPool(res.data);
    } catch {
      // silencieux — le picker modal reste dispo
    } finally {
      setPoolLoading(false);
    }
  }, []);

  const validate = useCallback(async () => {
    try {
      const v = await deckApi.validate(deckId);
      setErrors(v.errors || []);
    } catch {
      /* silencieux */
    }
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadPool();
    }, [refresh, loadPool])
  );

  const addFromPool = async (uc: UserCard) => {
    try {
      await deckApi.addCard(deckId, { card_id: uc.card_id, quantity: 1, is_extra_deck: false });
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Ajout échoué');
    }
  };

  const addCardToDeck = async (uc: UserCard) => {
    if (!pickerOpen) return;
    try {
      await deckApi.addCard(deckId, {
        card_id: uc.card_id,
        quantity: 1,
        is_extra_deck: pickerOpen === 'extra',
      });
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Ajout échoué');
    }
  };

  const removeSlot = async (dc: DeckCard) => {
    try {
      if (dc.quantity <= 1) {
        await deckApi.removeCard(deckId, dc.card_id);
      } else {
        await deckApi.setCardQuantity(deckId, dc.card_id, dc.quantity - 1);
      }
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Retrait échoué');
    }
  };

  const handleShare = async () => {
    if (!deck) return;
    try {
      let token = deck.share_token;
      if (!token) {
        const res = await deckApi.generateShare(deckId);
        token = res.shareToken;
        await refresh();
      }
      const url = `${API_URL}/deck/share/${token}`;
      await Share.share({ message: `Regarde mon deck "${deck.name}" : ${url}`, url });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Partage échoué');
    }
  };

  const handleDelete = () => {
    Alert.alert('Supprimer le deck ?', 'Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deckApi.remove(deckId);
            router.replace('/(tabs)/decks');
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.error || 'Suppression échouée');
          }
        },
      },
    ]);
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

  // Aplatit main_deck en slots individuels (24 max affichés, comme le mockup).
  const slots: Array<DeckCard | null> = [];
  for (const dc of deck.main_deck || []) {
    for (let i = 0; i < dc.quantity; i++) slots.push(dc);
  }
  const totalSlots = 24;
  while (slots.length < totalSlots) slots.push(null);

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* ═══ Header sticky : kicker + titre + Auto IA ═══ */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>— Atelier —</Text>
              <Text style={styles.title} numberOfLines={1}>
                {deck.name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setAiOpen(true)} style={styles.aiBtn}>
              <Text style={styles.aiBtnText}>⚡ Auto IA</Text>
            </TouchableOpacity>
          </View>

          {/* Row de 3 compteurs biseautés Main/Extra/Side */}
          <View style={styles.countersRow}>
            <View
              style={[
                styles.counter,
                {
                  borderColor: 'rgba(245,197,24,0.45)',
                  backgroundColor: 'rgba(245,197,24,0.1)',
                },
              ]}>
              <Text style={[styles.counterLabel, { color: colors.gold }]}>Main</Text>
              <Text style={[styles.counterVal, { color: colors.gold }]}>{mainCount}/40</Text>
            </View>
            <View
              style={[
                styles.counter,
                {
                  borderColor: 'rgba(168,85,247,0.45)',
                  backgroundColor: 'rgba(168,85,247,0.1)',
                },
              ]}>
              <Text style={[styles.counterLabel, { color: '#C084FC' }]}>Extra</Text>
              <Text style={[styles.counterVal, { color: '#C084FC' }]}>{extraCount}/15</Text>
            </View>
            <View
              style={[
                styles.counter,
                {
                  borderColor: 'rgba(34,211,238,0.4)',
                  backgroundColor: 'rgba(34,211,238,0.08)',
                },
              ]}>
              <Text style={[styles.counterLabel, { color: colors.cyan }]}>Side</Text>
              <Text style={[styles.counterVal, { color: colors.cyan }]}>— À venir</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Section « Deck principal » */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Deck principal</Text>
            <View style={styles.sectionSep} />
            <Text style={styles.sectionHint}>tap = retirer</Text>
          </View>

          {/* Grid 6 col de slots */}
          <View style={styles.slotsGrid}>
            {slots.map((dc, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => dc && removeSlot(dc)}
                disabled={!dc}
                style={[
                  styles.slot,
                  dc
                    ? {
                        backgroundColor: colors.panel2,
                        borderColor: 'rgba(245,197,24,0.4)',
                      }
                    : styles.slotEmpty,
                ]}>
                {dc ? (
                  dc.card?.card_images?.[0]?.image_url_small ? (
                    <Image
                      source={{ uri: dc.card.card_images[0].image_url_small }}
                      style={StyleSheet.absoluteFillObject as any}
                      resizeMode="cover"
                    />
                  ) : (
                    <Image
                      source={CARD_ICON}
                      style={{
                        width: '70%',
                        height: '70%',
                        tintColor: colors.gold,
                        opacity: 0.35,
                      }}
                      resizeMode="contain"
                    />
                  )
                ) : null}
              </TouchableOpacity>
            ))}
          </View>

          {/* Erreurs de validation */}
          {errors.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Erreurs de validation</Text>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>
                  · {e}
                </Text>
              ))}
            </View>
          )}

          {/* Section « Ma collection » horizontal scroll */}
          <View style={[styles.sectionRow, { marginTop: 24 }]}>
            <Text style={styles.sectionTitle}>Ma collection</Text>
            <View style={styles.sectionSep} />
            <Image
              source={SEARCH_ICON}
              style={{ width: 14, height: 14, tintColor: colors.textMuted }}
              resizeMode="contain"
            />
          </View>

          {poolLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : pool.length === 0 ? (
            <Text style={styles.emptyText}>Ta collection est vide. Ajoute d&apos;abord des cartes.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 9, paddingBottom: 4 }}>
              {pool.slice(0, 20).map((uc) => (
                <View key={uc.id} style={styles.poolWrap}>
                  <View style={styles.poolArt}>
                    {uc.card?.card_images?.[0]?.image_url_small ? (
                      <Image
                        source={{ uri: uc.card.card_images[0].image_url_small }}
                        style={StyleSheet.absoluteFillObject as any}
                        resizeMode="cover"
                      />
                    ) : (
                      <Image
                        source={CARD_ICON}
                        style={{
                          width: '52%',
                          height: '52%',
                          tintColor: colors.gold,
                          opacity: 0.3,
                        }}
                        resizeMode="contain"
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => addFromPool(uc)}
                      style={styles.poolAddBtn}>
                      <Text style={styles.poolAddText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.poolName} numberOfLines={1}>
                    {uc.card?.name || `#${uc.card_id}`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Boutons ajouter Main / Extra explicites (fallback si pool vide) */}
          <View style={styles.pickBtnRow}>
            <TouchableOpacity
              onPress={() => setPickerOpen('main')}
              style={[styles.pickBtn, { borderColor: colors.gold }]}>
              <Text style={[styles.pickBtnText, { color: colors.gold }]}>+ Main</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPickerOpen('extra')}
              style={[styles.pickBtn, { borderColor: colors.violet }]}>
              <Text style={[styles.pickBtnText, { color: colors.violet }]}>+ Extra</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.pickBtn}>
              <Text style={styles.pickBtnText}>Partager</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteText}>Sceller au néant</Text>
          </TouchableOpacity>
        </ScrollView>

        {pickerOpen && (
          <AddCardsFromCollectionModal
            visible={!!pickerOpen}
            target={pickerOpen}
            onClose={() => setPickerOpen(null)}
            onPick={addCardToDeck}
          />
        )}

        {aiOpen && (
          <AIBuilderModal
            visible={aiOpen}
            deckId={deckId}
            onClose={() => setAiOpen(false)}
            onBuilt={() => {
              setAiOpen(false);
              refresh();
              validate();
            }}
          />
        )}
      </SafeAreaView>
      <CornerOrnaments />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // ─── Header sticky ─────────────────────────────
    header: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 12,
      backgroundColor: t.colors.bgElev,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    iconBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnText: { fontSize: 22, color: t.colors.text },
    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 9,
      letterSpacing: 2.6,
      color: t.colors.gold,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 2,
      fontFamily: 'sans-serif',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: t.colors.text,
    },
    aiBtn: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: t.colors.violet,
      backgroundColor: 'rgba(168,85,247,0.12)',
      alignItems: 'center',
    },
    aiBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      color: t.colors.violet,
      textTransform: 'uppercase',
    },

    // ─── Counters ──────────────────────────────────
    countersRow: {
      marginTop: 12,
      flexDirection: 'row',
      gap: 6,
    },
    counter: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    counterLabel: {
      fontFamily: 'sans-serif',
      fontSize: 8,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      fontWeight: '600',
      opacity: 0.85,
    },
    counterVal: {
      fontFamily: 'sans-serif',
      fontSize: 14,
      fontWeight: '700',
    },

    // ─── Body ──────────────────────────────────────
    body: { padding: 18, paddingBottom: 96, gap: 8 },

    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    sectionTitle: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.6,
      color: t.colors.gold,
      textTransform: 'uppercase',
    },
    sectionSep: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border,
    },
    sectionHint: {
      fontSize: 10,
      color: t.colors.textMuted,
    },

    // ─── Slots grid 6 col ──────────────────────────
    slotsGrid: {
      marginTop: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 5,
    },
    slot: {
      // 6 col: (width - 5*5)/6
      width: `${(100 - (5 * 5) / 3.4) / 6}%`,
      aspectRatio: 59 / 86,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      overflow: 'hidden',
    },
    slotEmpty: {
      borderStyle: 'dashed',
      borderColor: 'rgba(245,197,24,0.2)',
      backgroundColor: 'rgba(255,255,255,0.015)',
    },

    // ─── Pool horizontal scroll ────────────────────
    poolWrap: {
      width: 74,
    },
    poolArt: {
      width: 74,
      height: 104,
      backgroundColor: t.colors.panel2,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    poolAddBtn: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: t.colors.gold,
      backgroundColor: 'rgba(11,9,6,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    poolAddText: {
      color: t.colors.gold,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 14,
    },
    poolName: {
      marginTop: 4,
      fontFamily: 'sans-serif',
      fontSize: 8,
      color: t.colors.textMuted,
    },

    emptyText: {
      fontSize: 13,
      color: t.colors.textMuted,
      fontStyle: 'italic',
      padding: 12,
      textAlign: 'center',
    },

    // ─── Buttons row ───────────────────────────────
    pickBtnRow: {
      marginTop: 18,
      flexDirection: 'row',
      gap: 8,
    },
    pickBtn: {
      flex: 1,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.panel,
    },
    pickBtnText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      letterSpacing: 1.2,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: t.colors.textMuted,
    },
    deleteBtn: {
      marginTop: 16,
      paddingVertical: 10,
      alignItems: 'center',
    },
    deleteText: {
      fontFamily: 'sans-serif',
      fontSize: 12,
      color: t.colors.danger,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontWeight: '600',
    },

    // ─── Erreurs ───────────────────────────────────
    errorBox: {
      marginTop: 10,
      padding: 12,
      backgroundColor: 'rgba(255,77,109,0.07)',
      borderWidth: 1,
      borderColor: 'rgba(255,77,109,0.4)',
      gap: 4,
    },
    errorTitle: {
      fontFamily: 'sans-serif',
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: t.colors.danger,
      textTransform: 'uppercase',
    },
    errorText: {
      fontSize: 12,
      color: t.colors.danger,
    },
  });
