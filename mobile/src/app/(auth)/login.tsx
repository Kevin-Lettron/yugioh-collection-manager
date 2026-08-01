import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { CornerOrnaments } from '@/components/decor/CornerOrnaments';
import { HeroTitle } from '@/components/decor/HeroTitle';
import { spacing } from '@/theme/palette';

export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || 'Erreur de connexion';
      Alert.alert('Connexion échouée', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <AppBackground />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap}>
            <HeroTitle
              kicker="— Retour au Sanctuaire —"
              title="Entrer"
              sub="Franchis le seuil pour retrouver ta vitrine."
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Courriel ou pseudo</Text>
            <TextInput
              style={styles.input}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="toi@exemple.fr"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
            />

            <Text style={styles.label}>Sceau</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              editable={!submitting}
              onSubmitEditing={handleSubmit}
            />

            <CyberButton
              label={submitting ? 'Invocation…' : 'Franchir le seuil'}
              onPress={handleSubmit}
              disabled={!canSubmit}
              loading={submitting}
              block
              cutColor={colors.panel}
              glitch
            />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Pas encore de sanctuaire ?</Text>
              <Link href="/(auth)/register" style={styles.footerLink}>
                En ouvrir un
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <CornerOrnaments />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: t.colors.bg },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[5] },
  heroWrap: {
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  card: {
    backgroundColor: t.colors.panel,
    padding: spacing[5],
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
    marginTop: spacing[2],
  },
  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderLeftWidth: 2,
    borderLeftColor: t.colors.gold,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 15,
    backgroundColor: t.colors.bgElev,
    color: t.colors.text,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  footerText: { color: t.colors.textMuted, fontSize: 14 },
  footerLink: { color: t.colors.gold, fontSize: 14, fontWeight: '600' },
});
