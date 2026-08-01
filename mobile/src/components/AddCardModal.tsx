import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { collectionApi, type SearchResult } from '@/services/collectionApi';
import type { CardLanguage } from '@/types';
import { LANGUAGE_LABELS } from '@/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
};

const RARITIES = [
  'Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare',
  'Ultimate Rare', 'Ghost Rare', 'Starlight Rare', "Collector's Rare",
  'Prismatic Secret Rare', 'Platinum Secret Rare', 'Quarter Century Secret Rare',
  'Gold Rare', 'Short Print',
];

export default function AddCardModal({ visible, onClose, onAdded }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [setCode, setSetCode] = useState('');
  const [rarity, setRarity] = useState('');
  const [language, setLanguage] = useState<CardLanguage>('EN');
  const [quantity, setQuantity] = useState('1');
  const [adding, setAdding] = useState(false);

  const reset = () => {
    setSearchQuery('');
    setResult(null);
    setSetCode('');
    setRarity('');
    setLanguage('EN');
    setQuantity('1');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setResult(null);
    try {
      const res = await collectionApi.search(searchQuery.trim());
      setResult(res);
      // Auto-fill from search result
      if (res.originalSetCode) {
        setSetCode(res.originalSetCode);
      } else if (res.matchedSet) {
        setSetCode(res.matchedSet.set_code);
      } else if (res.availableSets.length === 1) {
        setSetCode(res.availableSets[0].set_code);
      }
      if (res.matchedSet?.set_rarity) setRarity(res.matchedSet.set_rarity);
      if (res.detectedLanguage) setLanguage(res.detectedLanguage);
    } catch (err: any) {
      Alert.alert(
        'Carte introuvable',
        err?.response?.data?.error || err?.response?.data?.message || 'Aucun résultat pour ce code.'
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const canAdd =
    !!result?.card &&
    setCode.trim().length > 0 &&
    rarity.length > 0 &&
    parseInt(quantity, 10) > 0 &&
    !adding;

  const handleAdd = async () => {
    if (!canAdd || !result?.card) return;
    setAdding(true);
    try {
      await collectionApi.add({
        card_code: result.card.card_id,
        set_code: setCode.trim().toUpperCase(),
        rarity,
        language,
        quantity: parseInt(quantity, 10),
      });
      reset();
      onAdded();
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Ajout échoué');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ajouter une carte</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>ID de carte ou Code Set</Text>
          <Text style={styles.hint}>Ex : LDK2-FRK40 (sous l'illustration) ou 46986414</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="LDK2-FRK40"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              onSubmitEditing={handleSearch}
            />
            <CyberButton
              label="Chercher"
              variant="secondary"
              size="sm"
              onPress={handleSearch}
              disabled={!searchQuery.trim()}
              loading={searchLoading}
            />
          </View>

          {result?.card && (
            <>
              <View style={styles.previewBox}>
                {result.card.card_images?.[0] && (
                  <Image
                    source={{ uri: result.card.card_images[0].image_url_small }}
                    style={styles.previewImage}
                    resizeMode="contain"
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewName}>{result.card.name}</Text>
                  <Text style={styles.previewMeta}>{result.card.type}</Text>
                  {(result.card.atk !== undefined || result.card.def !== undefined) && (
                    <Text style={styles.previewMeta}>
                      ATK {result.card.atk ?? '?'} / DEF {result.card.def ?? '?'}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.label}>Code Set</Text>
              <TextInput
                style={styles.input}
                value={setCode}
                onChangeText={(v) => setSetCode(v.toUpperCase())}
                placeholder="LDK2-FRK40"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />

              {result.availableSets.length > 0 && (
                <>
                  <Text style={styles.hint}>
                    Ou choisir parmi {result.availableSets.length} set{result.availableSets.length > 1 ? 's' : ''} disponible{result.availableSets.length > 1 ? 's' : ''} :
                  </Text>
                  <View style={styles.setsList}>
                    {result.availableSets.map((s) => {
                      const selected = setCode === s.set_code;
                      return (
                        <TouchableOpacity
                          key={`${s.set_code}-${s.set_rarity}`}
                          style={[styles.setRow, selected && styles.setRowSelected]}
                          onPress={() => {
                            setSetCode(s.set_code);
                            setRarity(s.set_rarity);
                          }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.setCode, selected && styles.setCodeSelected]}>
                              {s.set_code}
                            </Text>
                            {s.set_name ? (
                              <Text
                                style={[styles.setName, selected && styles.setNameSelected]}
                                numberOfLines={1}>
                                {s.set_name}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.setRarity, selected && styles.setRaritySelected]}>
                            {s.set_rarity}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.label}>Rareté</Text>
              <View style={styles.rarityChips}>
                {(result.availableSets.length > 0
                  ? Array.from(new Set(result.availableSets.map((s) => s.set_rarity)))
                  : RARITIES
                ).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRarity(r)}
                    style={[
                      styles.rarityChip,
                      rarity === r && styles.rarityChipSelected,
                    ]}>
                    <Text
                      style={[
                        styles.rarityChipText,
                        rarity === r && styles.rarityChipTextSelected,
                      ]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Langue</Text>
              <View style={styles.rarityChips}>
                {(Object.keys(LANGUAGE_LABELS) as CardLanguage[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    onPress={() => setLanguage(lang)}
                    style={[
                      styles.rarityChip,
                      language === lang && styles.rarityChipSelected,
                    ]}>
                    <Text
                      style={[
                        styles.rarityChipText,
                        language === lang && styles.rarityChipTextSelected,
                      ]}>
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Quantité</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, '') || '1')}
                keyboardType="number-pad"
              />

              <CyberButton
                label="Ajouter à ma collection"
                variant="primary"
                onPress={handleAdd}
                disabled={!canAdd}
                loading={adding}
                block
                style={{ marginTop: 12 }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: t.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.colors.text },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: t.colors.textMuted },
  body: { padding: 16, gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: t.colors.text, marginTop: 4 },
  hint: { fontSize: 11, color: t.colors.textMuted },
  input: {
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: t.colors.border,
    color: t.colors.text,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: {
    backgroundColor: t.colors.cyan,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: { color: t.colors.onGold, fontSize: 14, fontWeight: '600' },
  previewBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  previewImage: { width: 70, height: 100 },
  previewName: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  previewMeta: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  rarityChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rarityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.colors.panel,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  rarityChipSelected: { backgroundColor: t.colors.gold, borderColor: t.colors.gold },
  rarityChipText: { fontSize: 12, color: t.colors.text, fontWeight: '500' },
  rarityChipTextSelected: { color: t.colors.onGold },
  addBtn: {
    backgroundColor: t.colors.gold,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  addBtnText: { color: t.colors.onGold, fontSize: 15, fontWeight: '600' },
  setsList: {
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.colors.border,
    maxHeight: 260,
    overflow: 'hidden',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    gap: 8,
  },
  setRowSelected: { backgroundColor: t.colors.panel2 },
  setCode: { fontSize: 13, fontWeight: '700', color: t.colors.text },
  setCodeSelected: { color: t.colors.gold },
  setName: { fontSize: 11, color: t.colors.textMuted, marginTop: 2 },
  setNameSelected: { color: t.colors.gold },
  setRarity: { fontSize: 11, color: t.colors.textMuted, fontWeight: '600' },
  setRaritySelected: { color: t.colors.gold },
});
