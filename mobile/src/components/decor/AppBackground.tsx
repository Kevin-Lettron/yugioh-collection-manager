import { memo, useEffect } from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme/ThemeContext';

const GLYPH_PYRAMID = require('@/assets/images/decor/glyph-pyramid.png');
const GLYPH_EYE = require('@/assets/images/decor/glyph-eye.png');

/** Pas de la trame, identique au web (44 px). */
const GRID_STEP = 44;

/**
 * Fond « Sanctuaire du Millénium ».
 *
 * Cinq couches, dans l'ordre de la maquette et du web :
 *   1. le fond plat ;
 *   2. le dégradé vertical, qui éclaircit le milieu d'écran ;
 *   3. la trame quadrillée ;
 *   4. le halo violet en haut, le contre-halo or en bas ;
 *   5. les glyphes flottants.
 *
 * L'intégration précédente n'avait que 1, un halo violet **plat** — un simple
 * `View` coloré à coins arrondis, sans dégradé — et 5. D'où un fond nettement
 * plus pauvre que la maquette, et sans le quadrillage qui la caractérise.
 *
 * Deux contraintes de React Native ont dicté les choix :
 *
 *   - **Pas de motif répété en fond.** La trame est donc dessinée : une `View`
 *     de 1 px par ligne, espacées de 44 px. Sur un écran de téléphone cela fait
 *     une trentaine de vues statiques, sans coût de rendu mesurable — et c'est
 *     exact au pixel, là où une image tuilée aurait bavé selon la densité.
 *   - **Pas de dégradé radial.** `expo-linear-gradient` ne fait que du linéaire.
 *     Les halos sont donc des dégradés linéaires posés en haut et en bas, ce qui
 *     rend très proche du radial de la maquette une fois l'opacité basse.
 */
function AppBackgroundBase() {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();

  const useFloat = () => {
    const y = useSharedValue(0);
    useEffect(() => {
      y.value = withRepeat(
        withSequence(
          withTiming(-24, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, [y]);
    return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  };

  const floatA = useFloat();
  const floatB = useFloat();
  const floatC = useFloat();

  const columns = Math.ceil(width / GRID_STEP) + 1;
  const rows = Math.ceil(height / GRID_STEP) + 1;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />

      {/* Dégradé vertical — c'est lui qui donne sa profondeur à l'écran, et sans
          lui la trame est trop faible pour se voir sur un fond quasi noir. */}
      <LinearGradient
        colors={[colors.bg, colors.bgElev, colors.bg]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Trame de circuit */}
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: columns }, (_, i) => (
          <View
            key={`c${i}`}
            style={{
              position: 'absolute',
              left: i * GRID_STEP,
              top: 0,
              bottom: 0,
              width: StyleSheet.hairlineWidth,
              backgroundColor: colors.grid,
            }}
          />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={`r${i}`}
            style={{
              position: 'absolute',
              top: i * GRID_STEP,
              left: 0,
              right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.grid,
            }}
          />
        ))}
      </View>

      {/* Halo violet en haut */}
      <LinearGradient
        colors={[colors.halo, 'transparent']}
        locations={[0, 1]}
        style={styles.haloTop}
      />

      {/* Contre-halo or en bas à gauche */}
      <LinearGradient
        colors={['transparent', colors.haloGold]}
        locations={[0, 1]}
        style={styles.haloBottom}
      />

      {/* Glyphes flottants */}
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
  haloTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  haloBottom: { position: 'absolute', bottom: 0, left: 0, right: '55%', height: 340 },
  glyphA: { position: 'absolute', top: '14%', left: -22 },
  glyphB: { position: 'absolute', top: '52%', right: -30 },
  glyphC: { position: 'absolute', bottom: '16%', left: '28%' },
});
