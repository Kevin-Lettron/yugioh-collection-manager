import { memo } from 'react';
import { View, Image, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useAppTheme } from '@/theme/ThemeContext';

export type CardRarity = 'common' | 'rare' | 'super' | 'ultra' | 'secret';

/**
 * Devine la rareté à partir d'un label libre (venant de l'API YGOProDeck).
 */
export function rarityFromLabel(label?: string | null): CardRarity {
  if (!label) return 'common';
  const l = label.toLowerCase();
  if (l.includes('secret') || l.includes('ghost') || l.includes('starlight')) return 'secret';
  if (l.includes('ultra')) return 'ultra';
  if (l.includes('super')) return 'super';
  if (l.includes('rare')) return 'rare';
  return 'common';
}

interface Props {
  /** URL image de la carte (petit format YGOProDeck) */
  uri?: string;
  /** Nom de la carte, affiché sous la tuile */
  name?: string;
  /** Rareté brute (label API) — traduite en preset via rarityFromLabel */
  rarity?: string | null;
  /** Quantité possédée */
  quantity?: number;
  /** Langue (drapeau simplifié, 2 lettres) */
  language?: string;
  /** Largeur imposée (sinon flex) */
  width?: number;
  onPress?: () => void;
}

/**
 * Tuile de carte YGO selon la charte v2 « Sanctuaire du Millénium ».
 * Traitement retenu par le user : glow par rareté + carte soulevée + reflet au sol.
 *
 * Glow simulé par shadowColor iOS + View glow semi-transparente sur Android.
 * Reflet simulé par une seconde Image inversée à faible opacité en dessous.
 */
function CardTileBase({
  uri,
  name,
  rarity,
  quantity = 1,
  language,
  width,
  onPress,
}: Props) {
  const { colors } = useAppTheme();
  const r = rarityFromLabel(rarity);

  const glowByRarity: Record<CardRarity, string> = {
    common: colors.rarityCommon,
    rare: colors.rarityRare,
    super: colors.raritySuper,
    ultra: colors.rarityUltra,
    secret: colors.raritySecret1,
  };

  const glowColor = glowByRarity[r];
  const glowRadius = r === 'ultra' || r === 'secret' ? 24 : r === 'super' ? 18 : r === 'rare' ? 14 : 6;

  const containerStyle = width
    ? [styles.wrap, { width }]
    : styles.wrap;

  return (
    <Pressable onPress={onPress} style={containerStyle}>
      {/* Halo par rareté — simulé Android (Platform-conditional) */}
      {Platform.OS === 'android' && r !== 'common' ? (
        <View
          pointerEvents="none"
          style={[
            styles.androidGlow,
            {
              backgroundColor: glowColor,
              shadowColor: glowColor,
            },
          ]}
        />
      ) : null}

      {/* Carte "soulevée" : shadowOffset iOS crée l'effet 3D + reflet au sol */}
      <View
        style={[
          styles.cardShell,
          {
            backgroundColor: colors.panel2,
            borderColor: r === 'common' ? colors.border : glowColor,
            shadowColor: r === 'common' ? '#000' : glowColor,
            shadowOffset: { width: 0, height: r === 'common' ? 4 : 8 },
            shadowOpacity: r === 'common' ? 0.3 : 0.6,
            shadowRadius: glowRadius,
            elevation: r === 'common' ? 3 : 8,
          },
        ]}>
        {uri ? (
          <Image source={{ uri }} style={styles.cardImage} resizeMode="cover" />
        ) : (
          <View style={[styles.cardImage, { backgroundColor: colors.panel }]} />
        )}

        {/* Nappe holographique pour Secret Rare — dégradé multi-couleurs statique */}
        {r === 'secret' ? (
          <View pointerEvents="none" style={styles.holoWrap}>
            <View
              style={[
                styles.holoBand,
                { backgroundColor: colors.raritySecret1, opacity: 0.18 },
              ]}
            />
            <View
              style={[
                styles.holoBand,
                { backgroundColor: colors.raritySecret2, opacity: 0.18, top: '40%' },
              ]}
            />
            <View
              style={[
                styles.holoBand,
                { backgroundColor: colors.rarityUltra, opacity: 0.15, top: '70%' },
              ]}
            />
          </View>
        ) : null}

        {/* Badge quantité */}
        {quantity > 0 ? (
          <View
            style={[
              styles.qty,
              { backgroundColor: colors.bg, borderColor: colors.gold },
            ]}>
            <Text style={[styles.qtyText, { color: colors.gold }]}>× {quantity}</Text>
          </View>
        ) : null}

        {/* Drapeau langue */}
        {language ? (
          <View
            style={[
              styles.lang,
              { backgroundColor: colors.bg, borderColor: colors.border },
            ]}>
            <Text style={[styles.langText, { color: colors.text }]}>{language.toUpperCase()}</Text>
          </View>
        ) : null}
      </View>

      {/* Reflet au sol — Image miroir à faible opacité */}
      {uri ? (
        <View style={styles.reflectionWrap} pointerEvents="none">
          <Image
            source={{ uri }}
            style={[
              styles.reflection,
              { transform: [{ scaleY: -1 }] },
            ]}
            resizeMode="cover"
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.bg, opacity: 0.7 },
            ]}
          />
        </View>
      ) : null}

      {name ? (
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
      {rarity ? (
        <Text style={[styles.rarity, { color: colors.textMuted }]} numberOfLines={1}>
          {rarity}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const CardTile = memo(CardTileBase);
export default CardTile;

const styles = StyleSheet.create({
  wrap: { alignItems: 'stretch', paddingBottom: 6 },
  androidGlow: {
    position: 'absolute',
    inset: 0,
    top: -6,
    left: -6,
    right: -6,
    bottom: 30,
    borderRadius: 12,
    opacity: 0.5,
  },
  cardShell: {
    aspectRatio: 59 / 100,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  holoWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  holoBand: {
    position: 'absolute',
    left: -20,
    right: -20,
    top: '10%',
    height: '25%',
    transform: [{ skewY: '-8deg' }],
  },
  qty: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  qtyText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  lang: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  langText: { fontSize: 9, fontWeight: '700' },
  reflectionWrap: {
    height: 14,
    marginTop: 2,
    overflow: 'hidden',
    opacity: 0.35,
  },
  reflection: { width: '100%', height: 100 },
  name: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.2,
  },
  rarity: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
