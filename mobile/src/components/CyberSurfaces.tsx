import { View, Text, StyleSheet, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

/**
 * Surfaces anguleuses partagées. Comme pour CyberButton, les biseaux sont des
 * carrés pivotés peints de la couleur du fond : passer `cutColor` dès que la
 * surface n'est pas posée directement sur `colors.bg`.
 */

interface BevelProps {
  size: number;
  color: string;
  corner: 'topRight' | 'bottomLeft';
}

/** Carré pivoté à 45° posé à cheval sur un angle : simule une coupe droite. */
function Bevel({ size, color, corner }: BevelProps) {
  const offset = -size / 2;
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        },
        corner === 'topRight' ? { right: offset, top: offset } : { left: offset, bottom: offset },
      ]}
    />
  );
}

interface PanelProps {
  children: React.ReactNode;
  glow?: boolean;
  cutColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Panneau : coin haut-droit biseauté, comme un coin de carte corné. */
export function CyberPanel({ children, glow = false, cutColor, style }: PanelProps) {
  const { colors, shape } = useAppTheme();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.panel,
          borderColor: glow ? colors.gold : colors.border,
        },
        glow && {
          shadowColor: colors.gold,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        style,
      ]}
    >
      <Bevel size={shape.bevelPanel} color={cutColor ?? colors.bg} corner="topRight" />
      {children}
    </View>
  );
}

/** Tuile : deux angles opposés coupés. Utilisée pour les cartes de collection. */
export function CyberTile({ children, cutColor, style }: PanelProps) {
  const { colors, shape } = useAppTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.panel, borderColor: colors.border }, style]}
    >
      <Bevel size={shape.bevelTile} color={cutColor ?? colors.bg} corner="topRight" />
      <Bevel size={shape.bevelTile} color={cutColor ?? colors.bg} corner="bottomLeft" />
      {children}
    </View>
  );
}

/** Titre de section : petites capitales dorées + filet. */
export function CyberTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors, type } = useAppTheme();
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.title, { color: colors.gold, letterSpacing: type.trackingWide }, style]}>
        {children}
      </Text>
      <View style={[styles.titleRule, { backgroundColor: colors.border }]} />
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: 'gold' | 'violet' | 'cyan' | 'success' | 'danger' | 'muted';
}

export function CyberBadge({ label, tone = 'muted' }: BadgeProps) {
  const { colors, type } = useAppTheme();
  const toneColor = {
    gold: colors.gold,
    violet: colors.violet,
    cyan: colors.cyan,
    success: colors.success,
    danger: colors.danger,
    muted: colors.textMuted,
  }[tone];

  return (
    <View style={[styles.badge, { borderColor: toneColor }]}>
      <Text style={[styles.badgeText, { color: toneColor, letterSpacing: type.tracking }]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Marque du produit : pyramide inversée + œil.
 * Dessinée avec des Views (triangle par bordures) pour éviter d'ajouter
 * react-native-svg, qui imposerait un rebuild natif.
 */
export function MillenniumMark({ size = 28, color }: { size?: number; color?: string }) {
  const { colors } = useAppTheme();
  const tint = color ?? colors.gold;
  const eye = Math.max(3, size * 0.16);

  return (
    <View style={{ width: size, height: size, alignItems: 'center' }} accessible={false}>
      {/* Triangle pointe en bas, obtenu par une bordure supérieure colorée */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: size / 2,
          borderRightWidth: size / 2,
          borderTopWidth: size * 0.86,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: tint,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.26,
          width: eye * 2.6,
          height: eye * 1.5,
          borderRadius: eye,
          borderWidth: 1.5,
          borderColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{ width: eye * 0.8, height: eye * 0.8, borderRadius: eye, backgroundColor: colors.bg }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, padding: 14, overflow: 'hidden' },
  tile: { borderWidth: 1, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  titleRule: { flex: 1, height: 1 },
  badge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
