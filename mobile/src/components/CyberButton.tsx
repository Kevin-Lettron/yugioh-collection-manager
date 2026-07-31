import { memo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

export type CyberButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface CyberButtonProps {
  label: string;
  onPress?: () => void;
  variant?: CyberButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
  /**
   * Couleur visible « derrière » le bouton. Les coins biseautés sont obtenus en
   * peignant des carrés de cette couleur par-dessus les angles : si elle ne
   * correspond pas au fond réel, le biseau se voit comme une tache.
   * Défaut : le fond de page.
   */
  cutColor?: string;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Étiquette d'angle décorative (ex. « R25 ») */
  tag?: string;
}

/**
 * Bouton cyber — transposition en React Native du bouton web.
 *
 * Le web découpe la forme au `clip-path`, qui n'existe pas ici. Le biseau est
 * donc simulé : un carré pivoté à 45°, de la couleur du fond, posé à cheval sur
 * le coin bas-gauche. Une seconde couche décalée de 5 px joue l'ombre colorée.
 * Aucune dépendance ajoutée (pas de react-native-svg).
 */
function CyberButtonBase({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  cutColor,
  block = false,
  style,
  tag,
}: CyberButtonProps) {
  const theme = useAppTheme();
  const { colors, shape, type } = theme;

  const palette: Record<CyberButtonVariant, { main: string; shadow: string; fg: string }> = {
    primary: { main: colors.gold, shadow: colors.violet, fg: colors.onGold },
    secondary: { main: colors.violet, shadow: colors.cyan, fg: '#FFFFFF' },
    danger: { main: colors.danger, shadow: colors.magenta, fg: '#FFFFFF' },
    ghost: { main: 'transparent', shadow: 'transparent', fg: colors.text },
  };

  const { main, shadow, fg } = palette[variant];
  const isGhost = variant === 'ghost';
  const inactive = disabled || loading;
  const bevel = size === 'sm' ? 12 : 16;
  const behind = cutColor ?? colors.bg;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.container,
        size === 'sm' ? styles.containerSm : styles.containerMd,
        block && styles.block,
        // La couche d'ombre déborde à droite : on réserve la place en marge
        // pour que le bouton ne chevauche pas son voisin.
        { marginRight: isGhost ? 0 : shape.buttonOffset },
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {/* Couche d'ombre, décalée */}
      {!isGhost && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: shadow, transform: [{ translateX: shape.buttonOffset }] },
          ]}
        />
      )}

      {/* Couche principale */}
      <View
        style={[
          StyleSheet.absoluteFill,
          isGhost
            ? { borderWidth: 1, borderColor: colors.gold }
            : { backgroundColor: main },
        ]}
      />

      {/* Biseau bas-gauche : carré pivoté de la couleur du fond */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -bevel / 2,
          bottom: -bevel / 2,
          width: bevel,
          height: bevel,
          backgroundColor: behind,
          transform: [{ rotate: '45deg' }],
        }}
      />

      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            size === 'sm' ? styles.labelSm : styles.labelMd,
            { color: fg, letterSpacing: type.trackingWide },
          ]}
        >
          {label}
        </Text>
      )}

      {tag && !loading && (
        <Text style={[styles.tag, { color: fg }]} pointerEvents="none">
          {tag}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    overflow: 'visible',
  },
  containerMd: { minHeight: 48, paddingHorizontal: 22, paddingVertical: 14 },
  containerSm: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 9 },
  block: { alignSelf: 'stretch' },
  pressed: { transform: [{ translateX: 2 }, { translateY: 1 }], opacity: 0.92 },
  inactive: { opacity: 0.45 },
  label: { fontWeight: '700', textTransform: 'uppercase' },
  labelMd: { fontSize: 14 },
  labelSm: { fontSize: 12 },
  tag: { position: 'absolute', right: 8, bottom: 2, fontSize: 8, opacity: 0.65 },
});

export const CyberButton = memo(CyberButtonBase);
export default CyberButton;
