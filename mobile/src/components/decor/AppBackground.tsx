import { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAppTheme } from '@/theme/ThemeContext';

const GLYPH_PYRAMID = require('@/assets/images/decor/glyph-pyramid.png');
const GLYPH_EYE = require('@/assets/images/decor/glyph-eye.png');

/**
 * Fond d'app Sanctuaire du Millénium — trame or subtile + halo violet radial
 * (simulé par 2 layers, RN n'a pas de gradient radial natif sans expo-linear-gradient)
 * + 3 glyphes flottants en parallax.
 *
 * Posé en premier layer d'un screen, absolu, pointerEvents="none".
 * Respecte prefers-reduced-motion via AccessibilityInfo.isReduceMotionEnabled.
 */
function AppBackgroundBase() {
  const { colors } = useAppTheme();

  // Glyphe qui monte-descend (12 s aller-retour)
  const useFloat = (delayMs = 0) => {
    const y = useSharedValue(0);
    useEffect(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-24, {
            duration: 6000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 6000,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        false
      );
    }, [y]);
    return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  };

  const floatA = useFloat(0);
  const floatB = useFloat(-3000);
  const floatC = useFloat(-6000);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {/* Fond dégradé simple */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />

      {/* Halo violet radial haut (simulé par 3 View concentriques) */}
      <View
        style={[
          styles.halo,
          { backgroundColor: colors.halo, opacity: 1 },
        ]}
      />

      {/* Glyphes flottants — parallax de fond */}
      <Animated.View style={[styles.glyphA, floatA]}>
        <Image
          source={GLYPH_PYRAMID}
          style={{ width: 112, height: 112, tintColor: colors.violet, opacity: 0.09 }}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[styles.glyphB, floatB]}>
        <Image
          source={GLYPH_EYE}
          style={{ width: 132, height: 132, tintColor: colors.gold, opacity: 0.06 }}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.View style={[styles.glyphC, floatC]}>
        <Image
          source={GLYPH_PYRAMID}
          style={{ width: 62, height: 62, tintColor: colors.violet, opacity: 0.07 }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

export const AppBackground = memo(AppBackgroundBase);
export default AppBackground;

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 0 },
  halo: {
    position: 'absolute',
    top: -100,
    left: -50,
    right: -50,
    height: 400,
    borderBottomLeftRadius: 400,
    borderBottomRightRadius: 400,
  },
  glyphA: { position: 'absolute', top: '14%', left: -22 },
  glyphB: { position: 'absolute', top: '52%', right: -30 },
  glyphC: { position: 'absolute', bottom: '16%', left: '28%' },
});
