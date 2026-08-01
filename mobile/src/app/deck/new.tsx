import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Switch,
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
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { spacing } from '@/theme/palette';

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
    <View style={styles.root}>
      <AppBackground />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerCrumb}>Fondation</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body}>
            <HeroTitle
              kicker="— Fonder un grimoire —"
              title="Nouveau deck"
              sub="Baptise ton grimoire et pose les premières règles."
            />

            <View style={styles.card}>
              <Text style={styles.label}>Nom du deck</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ex : Sanctuaire Draconique"
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreate}
              />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Deck public</Text>
                  <Text style={styles.toggleHint}>Visible dans la vitrine sociale</Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ true: colors.gold, false: colors.border }}
                  thumbColor={isPublic ? colors.onGold : colors.textMuted}
                />
              </View>

              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Respecter la banlist</Text>
                  <Text style={styles.toggleHint}>Bloque les cartes bannies (TCG)</Text>
                </View>
                <Switch
                  value={respectBanlist}
                  onValueChange={setRespectBanlist}
                  trackColor={{ true: colors.gold, false: colors.border }}
                  thumbColor={respectBanlist ? colors.onGold : colors.textMuted}
                />
              </View>

              <CyberButton
                label={creating ? 'Invocation…' : 'Sceller le grimoire'}
                variant="primary"
                onPress={handleCreate}
                disabled={!canCreate}
                loading={creating}
                block
                cutColor={colors.panel}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <CornerOrnaments />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  container: { flex: 1, backgroundColor: 'transparent' },
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
  closeText: { fontSize: 20, color: t.colors.textMuted },
  body: { padding: spacing[4], gap: spacing[4] },
  card: {
    backgroundColor: t.colors.panel,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[3],
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: t.colors.bgElev,
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
    backgroundColor: t.colors.bgElev,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: spacing[3],
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: t.colors.text },
  toggleHint: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
});
