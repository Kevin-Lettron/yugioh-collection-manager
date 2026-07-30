import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
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

export default function DeckEditorScreen() {
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const mainCount = deck.main_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const extraCount = deck.extra_deck?.reduce((s, c) => s + c.quantity, 0) || 0;
  const mainOk = mainCount >= 40 && mainCount <= 60;
  const extraOk = extraCount <= 15;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Éditer</Text>
        <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Name */}
        <Text style={styles.label}>Nom du deck</Text>
        <TextInput
          style={styles.nameInput}
          value={nameInput}
          onChangeText={setNameInput}
          onBlur={saveName}
          placeholder="Nom du deck"
          placeholderTextColor="#9ca3af"
          returnKeyType="done"
          onSubmitEditing={saveName}
        />

        {/* Toggles */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Deck public</Text>
            <Text style={styles.toggleHint}>Visible dans le feed</Text>
          </View>
          <Switch
            value={deck.is_public}
            onValueChange={(v) => toggleSetting('is_public', v)}
            trackColor={{ true: '#7c3aed' }}
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
            trackColor={{ true: '#7c3aed' }}
          />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statBadge, !mainOk && mainCount > 0 && styles.statBadgeBad]}>
            <Text style={styles.statLabel}>Main</Text>
            <Text style={[styles.statValue, !mainOk && mainCount > 0 && styles.statValueBad]}>
              {mainCount}
            </Text>
            <Text style={styles.statHint}>40–60</Text>
          </View>
          <View style={[styles.statBadge, !extraOk && styles.statBadgeBad]}>
            <Text style={styles.statLabel}>Extra</Text>
            <Text style={[styles.statValue, !extraOk && styles.statValueBad]}>{extraCount}</Text>
            <Text style={styles.statHint}>≤15</Text>
          </View>
        </View>

        {/* Validation errors */}
        {validating && (
          <View style={styles.errorBox}>
            <ActivityIndicator color="#7c3aed" size="small" />
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
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
            onPress={() => setPickerOpen('main')}>
            <Text style={styles.actionBtnText}>+ Main</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]}
            onPress={() => setPickerOpen('extra')}>
            <Text style={styles.actionBtnText}>+ Extra</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6366f1' }]}
            onPress={() => setAiOpen(true)}>
            <Text style={styles.actionBtnText}>🤖 AI</Text>
          </TouchableOpacity>
        </View>

        {/* Main deck */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Deck principal ({mainCount})</Text>
          {mainCount > 0 && (
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.sectionAction}>Vider</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cardGrid}>
          {(deck.main_deck || []).map((dc) => (
            <TouchableOpacity
              key={dc.id}
              style={styles.cardBox}
              onPress={() => showCardMenu(dc)}>
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
            </TouchableOpacity>
          ))}
          {mainCount === 0 && (
            <Text style={styles.emptyDeck}>Ajoute des cartes depuis ta collection.</Text>
          )}
        </View>

        {/* Extra deck */}
        <Text style={styles.sectionTitle}>Extra deck ({extraCount})</Text>
        <View style={styles.cardGrid}>
          {(deck.extra_deck || []).map((dc) => (
            <TouchableOpacity
              key={dc.id}
              style={styles.cardBox}
              onPress={() => showCardMenu(dc)}>
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
            </TouchableOpacity>
          ))}
          {extraCount === 0 && (
            <Text style={styles.emptyDeck}>Fusion / Synchro / XYZ / Link ici.</Text>
          )}
        </View>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>🗑️ Supprimer ce deck</Text>
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
  );
}

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
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  nameInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  toggleTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  toggleHint: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBadge: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  statBadgeBad: { borderColor: '#fecaca' },
  statLabel: { fontSize: 10, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#16a34a', marginVertical: 2 },
  statValueBad: { color: '#dc2626' },
  statHint: { fontSize: 10, color: '#9ca3af' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  errorTitle: { fontSize: 12, fontWeight: '700', color: '#991b1b' },
  errorText: { fontSize: 12, color: '#991b1b' },
  actionsGrid: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 8 },
  sectionAction: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
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
  emptyDeck: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic', padding: 12 },
  deleteBtn: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
