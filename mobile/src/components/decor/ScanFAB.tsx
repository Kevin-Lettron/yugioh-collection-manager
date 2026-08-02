import { memo, useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/theme/ThemeContext';

const SCAN = require('@/assets/images/ui/i-scan.png');

/**
 * FAB scan flottant — octogonal violet avec ring qui pulse.
 * Positionné bottom-right, au-dessus du tab bar.
 */
function ScanFABBase() {
  const { colors } = useAppTheme();
  const router = useRouter();

  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.6);

  useEffect(() => {
    ringScale.value = withRepeat(
      withTiming(1.35, { duration: 3000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    ringOpacity.value = withRepeat(
      withTiming(0, { duration: 3000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, [ringScale, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        onPress={() => router.push('/scan')}
        style={[styles.button, { backgroundColor: colors.violet }]}
        accessibilityLabel="Scanner une carte">
        {/* Ring animé */}
        <Animated.View
          style={[
            styles.ring,
            { borderColor: colors.violet },
            ringStyle,
          ]}
          pointerEvents="none"
        />
        {/* Biseau des 8 coins simulé par 4 carrés de la couleur du fond aux angles */}
        <View style={[styles.corner, styles.cornerTL, { backgroundColor: colors.bg }]} />
        <View style={[styles.corner, styles.cornerTR, { backgroundColor: colors.bg }]} />
        <View style={[styles.corner, styles.cornerBL, { backgroundColor: colors.bg }]} />
        <View style={[styles.corner, styles.cornerBR, { backgroundColor: colors.bg }]} />
        <Image
          source={SCAN}
          style={{ width: 26, height: 26, tintColor: '#FFFFFF' }}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

export const ScanFAB = memo(ScanFABBase);
export default ScanFAB;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 90,
  },
  button: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    // Ombre + glow
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  ring: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderWidth: 1,
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
  },
  cornerTL: { top: -6, left: -6 },
  cornerTR: { top: -6, right: -6 },
  cornerBL: { bottom: -6, left: -6 },
  cornerBR: { bottom: -6, right: -6 },
});
