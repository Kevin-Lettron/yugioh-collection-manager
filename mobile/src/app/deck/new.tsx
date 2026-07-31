import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deckApi } from '@/services/deckApi';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';

export default function NewDeckScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [respectBanlist, setRespectBanlist] = useState(true);
  const [creating, setCreating] = useState(false);

  const canCreate = name.trim().length > 0 && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const deck = await deckApi.create({
        name: name.trim(),
        is_public: isPublic,
        respect_banlist: respectBanlist,
      });
      router.replace(`/deck/edit/${deck.id}`);
    } catch (err: any) {
      Alert.alert('Erreur', err?.response?.data?.error || 'Création échouée');
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouveau deck</Text>
        <View style={{ width: 30 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>Nom du deck</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex : Dragons Nobles"
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Deck public</Text>
              <Text style={styles.toggleHint}>Visible dans le feed social</Text>
            </View>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: colors.gold }} />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Respecter la banlist</Text>
              <Text style={styles.toggleHint}>Bloque les cartes bannies (TCG)</Text>
            </View>
            <Switch
              value={respectBanlist}
              onValueChange={setRespectBanlist}
              trackColor={{ true: colors.gold }}
            />
          </View>

          <TouchableOpacity
            style={[styles.createBtn, !canCreate && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={!canCreate}>
            {creating ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <Text style={styles.createBtnText}>Créer le deck</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: t.colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  closeBtn: { padding: 4, width: 30 },
  closeText: { fontSize: 22, color: t.colors.textMuted },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.colors.text, textAlign: 'center' },
  body: { padding: 16, gap: 16 },
  label: { fontSize: 13, fontWeight: '600', color: t.colors.text },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: t.colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 12,
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: t.colors.text },
  toggleHint: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  createBtn: {
    backgroundColor: t.colors.gold,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  createBtnText: { color: t.colors.onGold, fontSize: 15, fontWeight: '600' },
});
