import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { deckApi } from '@/services/deckApi';
import type { AIStatus } from '@/types';

type Props = {
  visible: boolean;
  deckId: number;
  onClose: () => void;
  onBuilt: () => void;
};

export default function AIBuilderModal({ visible, deckId, onClose, onBuilt }: Props) {
  const [prompt, setPrompt] = useState('');
  const [respectBanlist, setRespectBanlist] = useState(true);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; notes?: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    deckApi.aiStatus().then(setStatus).catch(() => setStatus(null));
    setPrompt('');
    setResult(null);
  }, [visible]);

  const handleBuild = async () => {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    try {
      const res = await deckApi.aiBuild({
        deck_id: deckId,
        prompt: prompt.trim(),
        respect_banlist: respectBanlist,
      });
      setResult({ added: res.added, skipped: res.skipped, notes: res.notes });
    } catch (err: any) {
      const message =
        err?.response?.status === 429
          ? 'Limite de builds AI atteinte. Réessaie plus tard.'
          : err?.response?.data?.error || 'Build AI échoué';
      Alert.alert('Erreur', message);
    } finally {
      setBuilding(false);
    }
  };

  const handleDone = () => {
    onBuilt();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🤖 AI Deck Builder</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {status && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                {status.remaining} build{status.remaining > 1 ? 's' : ''} restant{status.remaining > 1 ? 's' : ''} ({status.used}/{status.max} utilisés)
              </Text>
            </View>
          )}

          {!result ? (
            <>
              <Text style={styles.label}>Décris le deck que tu veux</Text>
              <Text style={styles.hint}>
                Ex : "Un deck Dragons Bleus focus contrôle avec Blue-Eyes White Dragon en pièce maîtresse"
              </Text>
              <TextInput
                style={styles.textArea}
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Ton prompt…"
                placeholderTextColor="#9ca3af"
                multiline
                editable={!building}
                autoFocus
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Respecter la banlist</Text>
                  <Text style={styles.toggleHint}>Recommande à laisser activé</Text>
                </View>
                <Switch
                  value={respectBanlist}
                  onValueChange={setRespectBanlist}
                  trackColor={{ true: '#7c3aed' }}
                />
              </View>

              <Text style={styles.warning}>
                ⚠️ L'IA ne pioche que dans les cartes que tu possèdes déjà.
              </Text>

              <TouchableOpacity
                style={[styles.buildBtn, (!prompt.trim() || building) && { opacity: 0.5 }]}
                onPress={handleBuild}
                disabled={!prompt.trim() || building}>
                {building ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.buildBtnText}>Génération… (~10-30s)</Text>
                  </>
                ) : (
                  <Text style={styles.buildBtnText}>Générer le deck</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.resultBox}>
                <Text style={styles.resultTitle}>✨ Deck généré</Text>
                <Text style={styles.resultLine}>
                  {result.added} carte{result.added > 1 ? 's' : ''} ajoutée{result.added > 1 ? 's' : ''}
                </Text>
                {result.skipped > 0 && (
                  <Text style={styles.resultLineWarn}>
                    {result.skipped} carte{result.skipped > 1 ? 's' : ''} ignorée{result.skipped > 1 ? 's' : ''} (indisponibles)
                  </Text>
                )}
                {result.notes ? (
                  <Text style={styles.resultNotes}>{result.notes}</Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.buildBtn} onPress={handleDone}>
                <Text style={styles.buildBtnText}>Voir le résultat</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 22, color: '#6b7280' },
  body: { padding: 16, gap: 12 },
  statusBox: {
    padding: 10,
    backgroundColor: '#ede9fe',
    borderRadius: 8,
  },
  statusText: { fontSize: 12, color: '#5b21b6', fontWeight: '600', textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '700', color: '#111827', marginTop: 4 },
  hint: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
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
  warning: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
  },
  buildBtn: {
    backgroundColor: '#7c3aed',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buildBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultBox: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
    gap: 6,
  },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#166534' },
  resultLine: { fontSize: 14, color: '#111827' },
  resultLineWarn: { fontSize: 13, color: '#92400e' },
  resultNotes: { fontSize: 12, color: '#6b7280', fontStyle: 'italic', marginTop: 6 },
});
