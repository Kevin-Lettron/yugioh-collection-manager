import { memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

const CORNER = require('@/assets/images/decor/corner.png');

/**
 * 4 ornements de coin dorés — égyptien géométrique. Posés en overlay fixed
 * sur les 4 coins d'un screen. Opacité 0.4, jamais interactifs.
 *
 * Usage : à monter tout en haut d'un écran, absolu, dernier layer visuel
 * (z-index élevé mais pointerEvents="none").
 */
function CornerOrnamentsBase({ size = 44, offset = 8 }: { size?: number; offset?: number }) {
  const { colors } = useAppTheme();

  const base = {
    position: 'absolute' as const,
    width: size,
    height: size,
    tintColor: colors.gold,
    opacity: 0.4,
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={CORNER} style={{ ...base, top: offset, left: offset }} resizeMode="contain" />
      <Image
        source={CORNER}
        style={{ ...base, top: offset, right: offset, transform: [{ scaleX: -1 }] }}
        resizeMode="contain"
      />
      <Image
        source={CORNER}
        style={{ ...base, bottom: offset, left: offset, transform: [{ scaleY: -1 }] }}
        resizeMode="contain"
      />
      <Image
        source={CORNER}
        style={{
          ...base,
          bottom: offset,
          right: offset,
          transform: [{ scaleX: -1 }, { scaleY: -1 }],
        }}
        resizeMode="contain"
      />
    </View>
  );
}

export const CornerOrnaments = memo(CornerOrnamentsBase);
export default CornerOrnaments;
