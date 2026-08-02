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

/**
 * Fondation d'un grimoire — variante minimaliste du sc-if `isEditor` :
 * kicker + titre + 1 champ nom + 2 toggles + CTA « Sceller le grimoire ».
 * Une fois créé, redirige vers l'atelier (deck/edit/[id]).
 */
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
        <View style={styles.chromeHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.chromeBtn}>
            <Text style={styles.chromeBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body}>
            {/* Hero — kicker + titre style Atelier */}
            <View style={{ paddingHorizontal: 4, marginBottom: 6 }}>
              <Text style={styles.kicker}>— Atelier · Fondation —</Text>
              <Text style={styles.title}>Nouveau deck</Text>
              <Text style={styles.sub}>
                Baptise ton grimoire et pose les premières règles.
              </Text>
            </View>

            {/* Champ nom */}
            <Text style={styles.fieldLabel}>Nom du deck</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex : Sanctuaire draconique"
              placeholderTextColor={colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            {/* Toggles */}
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

            <View style={{ marginTop: 12 }}>
              <CyberButton
                label={creating ? 'Invocation…' : 'Sceller le grimoire'}
                variant="primary"
                onPress={handleCreate}
                disabled={!canCreate}
                loading={creating}
                block
                cutColor={colors.bg}
                glitch
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
    chromeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    chromeBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chromeBtnText: { fontSize: 18, color: t.colors.textMuted },
    body: {
      padding: 18,
      gap: 14,
    },
    kicker: {
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.6,
      color: t.colors.gold,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    title: {
      fontFamily: 'sans-serif',
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: t.colors.text,
      lineHeight: 30,
    },
    sub: {
      marginTop: 6,
      fontSize: 13,
      color: t.colors.textMuted,
    },
    fieldLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 2,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      fontWeight: '600',
      marginBottom: 5,
      marginTop: 4,
    },
    input: {
      width: '100%',
      paddingHorizontal: 14,
      paddingVertical: 13,
      backgroundColor: t.colors.bgElev,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.gold,
      color: t.colors.text,
      fontSize: 15,
    },
    toggleRow: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: t.colors.panel,
      borderWidth: 1,
      borderColor: t.colors.border,
      gap: 12,
    },
    toggleTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: t.colors.text,
    },
    toggleHint: {
      fontSize: 11,
      color: t.colors.textMuted,
      marginTop: 2,
    },
  });
