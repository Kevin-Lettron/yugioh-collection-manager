import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

interface Props {
  /** Ornement Cormorant italique au-dessus du titre (ex. « — Vitrine du Millénium — ») */
  kicker?: string;
  /** Titre principal en Orbitron uppercase */
  title: string;
  /** Sous-titre optionnel en Rajdhani */
  sub?: string;
}

/**
 * Titre de page selon la charte v2. Le titre est en Orbitron 900 uppercase
 * avec un dégradé blanc → or via NativeText (approximation : couleur unie or,
 * RN ne supporte pas le gradient sur du texte sans lib).
 */
export function HeroTitle({ kicker, title, sub }: Props) {
  const { colors, type } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {kicker ? (
        <Text
          style={[
            styles.kicker,
            { color: colors.gold, letterSpacing: type.trackingWide + 1 },
          ]}>
          {kicker}
        </Text>
      ) : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {sub ? (
        <Text style={[styles.sub, { color: colors.textMuted }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: 8 },
  kicker: {
    // Cormorant Garamond italique en fallback serif (pas de font custom RN)
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 32,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
});

export default HeroTitle;
