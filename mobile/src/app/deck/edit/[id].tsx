import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { deckApi } from '@/services/deckApi';
import type { Deck, DeckCard, UserCard } from '@/types';
import { API_URL } from '@/config';
import AddCardsFromCollectionModal from '@/components/AddCardsFromCollectionModal';
import AIBuilderModal from '@/components/AIBuilderModal';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { CardTile } from '@/components/decor/CardTile';
import { spacing } from '@/theme/palette';

export default function DeckEditorScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [pickerOpen, setPickerOpen] = useState<'main' | 'extra' | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await deckApi.get(deckId);
      setDeck(d);
      setNameInput(d.name);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Deck introuvable');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [deckId, router]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const validate = useCallback(async () => {
    setValidating(true);
    try {
      const v = await deckApi.validate(deckId);
      setErrors(v.errors || []);
    } catch {
      // ignore
    } finally {
      setValidating(false);
    }
  }, [deckId]);

  const saveName = async () => {
    if (!deck || nameInput.trim() === deck.name || !nameInput.trim()) return;
    try {
      const updated = await deckApi.update(deckId, { name: nameInput.trim() });
      setDeck(updated);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Renommage échoué');
      setNameInput(deck.name);
    }
  };

  const toggleSetting = async (key: 'is_public' | 'respect_banlist', value: boolean) => {
    if (!deck) return;
    // Optimistic
    setDeck({ ...deck, [key]: value });
    try {
      await deckApi.update(deckId, { [key]: value });
    } catch (err: any) {
      setDeck({ ...deck, [key]: !value });
      Alert.alert('Erreur', err?.response?.data?.error || 'Mise à jour échouée');
    }
  };

  const addCardToDeck = async (uc: UserCard) => {
    if (!deck || !pickerOpen) return;
    const isExtra = pickerOpen === 'extra';
    try {
      await deckApi.addCard(deckId, {
        card_id: uc.card_id,
        quantity: 1,
        is_extra_deck: isExtra,
      });
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Ajout échoué');
    }
  };

  const changeCardQty = (dc: DeckCard, delta: number) => async () => {
    const next = dc.quantity + delta;
    try {
      if (next < 1) {
        await deckApi.removeCard(deckId, dc.card_id);
      } else {
        await deckApi.setCardQuantity(deckId, dc.card_id, next);
      }
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Mise à jour échouée');
    }
  };

  const removeCard = (dc: DeckCard) => async () => {
    try {
      await deckApi.removeCard(deckId, dc.card_id);
      await refresh();
      await validate();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Retrait échoué');
    }
  };

  const showCardMenu = (dc: DeckCard) => {
    Alert.alert(dc.card?.name || `Carte #${dc.card_id}`, `Actuellement : ${dc.quantity}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: '−1', onPress: changeCardQty(dc, -1) },
      { text: '+1', onPress: changeCardQty(dc, 1) },
      { text: 'Retirer', style: 'destructive', onPress: removeCard(dc) },
    ]);
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
      await Share.share({
        message: `Regarde mon deck "${deck.name}" : ${url}`,
        url,
      });
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Partage échoué');
    }
  };

  const handleClear = () => {
    Alert.alert('Vider le deck ?', 'Toutes les cartes seront retirées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: async () => {
          try {
            await deckApi.clearCards(deckId);
            await refresh();
            await validate();
          } catch (err: any) {
            Alert.alert('Erreur', err?.response?.data?.error || 'Vidage échoué');
          }
        },
      },
    ]);
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
  const mainOk = mainCount >= 40 && mainCount <= 60;
  const extraOk = extraCount <= 15;

  return (
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerCrumb}>Atelier</Text>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>↗</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <HeroTitle
            kicker="— Atelier —"
            title={deck.name || 'Deck sans nom'}
            sub={`Main ${mainCount}/40 · Extra ${extraCount}/15`}
          />

          {/* Name */}
          <Text style={styles.label}>Nom du deck</Text>
          <TextInput
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={saveName}
            placeholder="Nom du deck"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={saveName}
          />

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Deck public</Text>
              <Text style={styles.toggleHint}>Visible dans la vitrine sociale</Text>
            </View>
            <Switch
              value={deck.is_public}
              onValueChange={(v) => toggleSetting('is_public', v)}
              trackColor={{ true: colors.gold, false: colors.border }}
              thumbColor={deck.is_public ? colors.onGold : colors.textMuted}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Respecter la banlist</Text>
              <Text style={styles.toggleHint}>Vérifie la conformité TCG</Text>
            </View>
            <Switch
              value={deck.respect_banlist}
              onValueChange={(v) => toggleSetting('respect_banlist', v)}
              trackColor={{ true: colors.gold, false: colors.border }}
              thumbColor={deck.respect_banlist ? colors.onGold : colors.textMuted}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, mainOk ? styles.statBadgeOk : mainCount > 0 && styles.statBadgeBad]}>
              <View style={[styles.statAccent, { backgroundColor: mainOk ? colors.gold : colors.danger }]} pointerEvents="none" />
              <Text style={styles.statLabel}>Main</Text>
              <Text style={[styles.statValue, !mainOk && mainCount > 0 && styles.statValueBad]}>
                {mainCount}/40
              </Text>
              <Text style={styles.statHint}>40–60</Text>
            </View>
            <View style={[styles.statBadge, extraOk ? styles.statBadgeOk : styles.statBadgeBad]}>
              <View style={[styles.statAccent, { backgroundColor: extraOk ? colors.violet : colors.danger }]} pointerEvents="none" />
              <Text style={styles.statLabel}>Extra</Text>
              <Text style={[styles.statValue, !extraOk && styles.statValueBad]}>{extraCount}/15</Text>
              <Text style={styles.statHint}>≤15</Text>
            </View>
          </View>

          {/* Validation errors */}
          {validating && (
            <View style={styles.errorBox}>
              <ActivityIndicator color={colors.gold} size="small" />
              <Text style={styles.errorText}>Validation…</Text>
            </View>
          )}
          {errors.length > 0 && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Erreurs de validation</Text>
              {errors.map((e, i) => (
                <Text key={i} style={styles.errorText}>
                  • {e}
                </Text>
              ))}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsGrid}>
            <CyberButton
              label="+ Main"
              variant="primary"
              size="sm"
              onPress={() => setPickerOpen('main')}
              block
              style={{ flex: 1 }}
              cutColor={colors.bg}
            />
            <CyberButton
              label="+ Extra"
              variant="primary"
              size="sm"
              onPress={() => setPickerOpen('extra')}
              block
              style={{ flex: 1 }}
              cutColor={colors.bg}
            />
            <CyberButton
              label="AI"
              variant="secondary"
              size="sm"
              onPress={() => setAiOpen(true)}
              block
              style={{ flex: 1 }}
              tag="BOT"
              cutColor={colors.bg}
            />
          </View>

          {/* Main deck */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Deck principal</Text>
            <Text style={styles.sectionCount}>{mainCount}</Text>
            <View style={styles.sectionSep} />
            {mainCount > 0 && (
              <CyberButton
                label="Vider"
                variant="danger"
                size="sm"
                onPress={handleClear}
                cutColor={colors.bg}
              />
            )}
          </View>
          <View style={styles.cardGrid}>
            {(deck.main_deck || []).map((dc) => (
              <View key={dc.id} style={styles.cardCell}>
                <CardTile
                  uri={dc.card?.card_images?.[0]?.image_url_small}
                  name={dc.card?.name}
                  quantity={dc.quantity}
                  onPress={() => showCardMenu(dc)}
                />
              </View>
            ))}
            {mainCount === 0 && (
              <Text style={styles.emptyDeck}>Ajoute des cartes depuis ta collection.</Text>
            )}
          </View>

          {/* Extra deck */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Extra deck</Text>
            <Text style={styles.sectionCount}>{extraCount}</Text>
            <View style={styles.sectionSep} />
          </View>
          <View style={styles.cardGrid}>
            {(deck.extra_deck || []).map((dc) => (
              <View key={dc.id} style={styles.cardCell}>
                <CardTile
                  uri={dc.card?.card_images?.[0]?.image_url_small}
                  name={dc.card?.name}
                  quantity={dc.quantity}
                  onPress={() => showCardMenu(dc)}
                />
              </View>
            ))}
            {extraCount === 0 && (
              <Text style={styles.emptyDeck}>Fusion / Synchro / XYZ / Link ici.</Text>
            )}
          </View>

          {/* Delete */}
          <CyberButton
            label="Supprimer ce deck"
            variant="danger"
            onPress={handleDelete}
            block
            style={{ marginTop: spacing[4] }}
            cutColor={colors.bg}
          />
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
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing[2],
  },
  nameInput: {
    backgroundColor: t.colors.panel,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 15,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 2,
    borderLeftColor: t.colors.gold,
    color: t.colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[2],
  },
  toggleTitle: { fontSize: 13, fontWeight: '600', color: t.colors.text },
  toggleHint: { fontSize: 11, color: t.colors.textMuted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statBadge: {
    flex: 1,
    backgroundColor: t.colors.panel,
    padding: spacing[3],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  statBadgeOk: { borderColor: t.colors.gold },
  statBadgeBad: { borderColor: t.colors.danger },
  statAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    opacity: 0.7,
  },
  statLabel: {
    fontSize: 9,
    color: t.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: t.colors.gold,
    marginVertical: 2,
  },
  statValueBad: { color: t.colors.danger },
  statHint: { fontSize: 10, color: t.colors.textMuted },
  errorBox: {
    backgroundColor: t.colors.panel2,
    borderWidth: 1,
    borderColor: t.colors.danger,
    padding: spacing[3],
    gap: spacing[1],
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.danger,
    letterSpacing: 1,
    textTransform: 'uppercase',
    width: '100%',
  },
  errorText: { fontSize: 12, color: t.colors.danger, width: '100%' },
  actionsGrid: { flexDirection: 'row', gap: spacing[2] },
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
});
