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
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useAppTheme, type Theme } from '@/theme/ThemeContext';
import CyberButton from '@/components/CyberButton';
import { AppBackground } from '@/components/decor/AppBackground';
import { spacing } from '@/theme/palette';

const GLYPH_EYE = require('@/assets/images/decor/glyph-eye.png');

/**
 * Login — sc-if `isAuth` de PhoneFrame.dc.html (l.97-127).
 * Layout centré : logo Millénium 52px, kicker Cormorant italique, titre Orbitron
 * uppercase, 2 champs, CTA primary « Franchir le seuil », divider avec glyphe œil,
 * bouton Discord secondaire, lien vers register.
 */
export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useAppTheme();
  const router = useRouter();
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
      const msg = err?.response?.data?.error || err?.message || 'Erreur de connexion';
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
          {/* Logo + kicker + titre — centrés (PhoneFrame l.100-104) */}
          <View style={styles.hero}>
            <MillenniumLogo color={colors.gold} size={52} />
            <Text style={styles.kicker}>— Retour au sanctuaire —</Text>
            <Text style={styles.title}>Entrer</Text>
          </View>

          {/* Champs — Orbitron 9px labels + inputs borderLeft or */}
          <View style={styles.fields}>
            <View>
              <Text style={styles.fieldLabel}>Courriel ou pseudo</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="kaiba_pa"
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
              />
            </View>

            <View>
              <Text style={styles.fieldLabel}>Sceau</Text>
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
            </View>

            {/* CTA primary — « Franchir le seuil » */}
            <View style={{ marginTop: 8 }}>
              <CyberButton
                label={submitting ? 'Invocation…' : 'Franchir le seuil'}
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={submitting}
                block
                cutColor={colors.bg}
                glitch
              />
            </View>

            {/* Divider avec glyphe œil (PhoneFrame l.117-121) */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Image
                source={GLYPH_EYE}
                style={{ width: 16, height: 16, tintColor: colors.goldDim, opacity: 0.8 }}
                resizeMode="contain"
              />
              <View style={styles.dividerLine} />
            </View>

            {/* Discord button secondaire — 46px, bgElev, textMuted */}
            <TouchableOpacity
              style={styles.discordBtn}
              onPress={() =>
                Alert.alert('— À venir —', 'La connexion Discord arrive bientôt.')
              }>
              <Text style={styles.discordText}>Continuer avec Discord</Text>
            </TouchableOpacity>

            {/* Toggle auth link */}
            <TouchableOpacity
              style={{ marginTop: 4, alignSelf: 'center' }}
              onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.switchLink}>Pas encore de sanctuaire ? En ouvrir un</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Logo Millennium simplifié — triangle inversé (borderTop) + point central noir. */
function MillenniumLogo({ color, size = 52 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        // Glow doré via shadowColor
        shadowColor: color,
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderLeftColor: 'transparent',
          borderRightWidth: size / 2,
          borderRightColor: 'transparent',
          borderTopWidth: (size * 22) / 26,
          borderTopColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.24,
          alignSelf: 'center',
          width: size * 0.15,
          height: size * 0.15,
          borderRadius: (size * 0.15) / 2,
          backgroundColor: '#0B0906',
        }}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.bg },
    container: { flex: 1, backgroundColor: 'transparent' },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 26,
      paddingVertical: spacing[5],
    },
    hero: {
      alignItems: 'center',
      marginBottom: 26,
    },
    kicker: {
      marginTop: 14,
      fontFamily: 'serif',
      fontStyle: 'italic',
      fontSize: 10,
      letterSpacing: 2.8,
      color: t.colors.gold,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 6,
      fontFamily: 'sans-serif',
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: t.colors.text,
      textAlign: 'center',
    },
    fields: {
      gap: 12,
    },
    fieldLabel: {
      fontFamily: 'sans-serif',
      fontSize: 9,
      letterSpacing: 2,
      color: t.colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 5,
      fontWeight: '600',
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
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 6,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border,
    },
    discordBtn: {
      width: '100%',
      height: 46,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.panel,
      alignItems: 'center',
      justifyContent: 'center',
    },
    discordText: {
      fontFamily: 'sans-serif',
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: t.colors.textMuted,
    },
    switchLink: {
      color: t.colors.textMuted,
      fontSize: 13,
      textDecorationLine: 'underline',
      textDecorationColor: t.colors.goldDim,
    },
  });
