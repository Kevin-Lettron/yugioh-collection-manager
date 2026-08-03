/**
 * Palette — miroir de client/src/styles/theme.css et de la charte graphique
 * (docs/maquette-cyberpunk.html §2). Toute valeur modifiée ici doit l'être aux
 * deux autres endroits, sous peine de voir le web et le mobile diverger.
 *
 * Rôles, en résumé :
 *   gold     action primaire, focus, marque — une seule action or par écran
 *   violet   secondaire : ombre décalée des boutons, actions non principales
 *   cyan     accent ponctuel, informations
 *   magenta  alerte forte et rare
 *   success  confirmation · danger  erreur et destructif
 */

export interface Palette {
  bg: string;
  bgElev: string;
  panel: string;
  panel2: string;
  border: string;
  text: string;
  textMuted: string;
  gold: string;
  goldDim: string;
  violet: string;
  /** Violet clair — compteurs Extra Deck, accents secondaires */
  violetSoft: string;
  cyan: string;
  magenta: string;
  success: string;
  danger: string;
  onGold: string;
  /** Voile des modales, posé par-dessus l'écran */
  scrim: string;
  /** Fond des zones caméra : du vrai noir, jamais thémé */
  camera: string;
  /** Trame de fond quadrillée (or ambient) */
  grid: string;
  /** Halo violet radial du haut de page */
  halo: string;
  /** Halos par rareté (rgba pour blend inline) */
  rarityCommon: string;
  rarityRare: string;
  raritySuper: string;
  rarityUltra: string;
  raritySecret1: string;
  raritySecret2: string;
}

export const darkPalette: Palette = {
  bg: '#0B0906',
  bgElev: '#14100A',
  panel: '#1A1510',
  panel2: '#221B12',
  border: '#3A2E1C',
  text: '#F5EFE0',
  textMuted: '#A99C86',
  gold: '#F5C518',
  goldDim: '#C29A0F',
  violet: '#A855F7',
  violetSoft: '#C084FC',
  cyan: '#22D3EE',
  magenta: '#FF2E88',
  success: '#34D399',
  danger: '#FF4D6D',
  onGold: '#0B0906',
  scrim: 'rgba(0, 0, 0, 0.72)',
  camera: '#000000',
  grid: 'rgba(245, 197, 24, 0.05)',
  halo: 'rgba(168, 85, 247, 0.16)',
  rarityCommon: 'rgba(255, 255, 255, 0.05)',
  rarityRare: 'rgba(59, 130, 246, 0.4)',
  raritySuper: 'rgba(168, 85, 247, 0.5)',
  rarityUltra: 'rgba(245, 197, 24, 0.55)',
  raritySecret1: 'rgba(255, 46, 136, 0.4)',
  raritySecret2: 'rgba(34, 211, 238, 0.3)',
};

export const lightPalette: Palette = {
  bg: '#F7F3EA',
  bgElev: '#FFFFFF',
  panel: '#FFFFFF',
  panel2: '#F2ECDD',
  border: '#DCCFB0',
  text: '#1A1206',
  textMuted: '#6B5E45',
  // L'or néon tombe à 1,8:1 sur fond clair : illisible. D'où ce bronze.
  gold: '#8A6D0B',
  goldDim: '#6B5408',
  violet: '#7C3AED',
  violetSoft: '#6428C4',
  cyan: '#0E7490',
  magenta: '#C2185B',
  success: '#047857',
  danger: '#BE123C',
  onGold: '#FFFFFF',
  scrim: 'rgba(26, 18, 6, 0.55)',
  camera: '#000000',
  grid: 'rgba(138, 109, 11, 0.06)',
  halo: 'rgba(124, 58, 237, 0.10)',
  rarityCommon: 'rgba(0, 0, 0, 0.08)',
  rarityRare: 'rgba(29, 78, 216, 0.35)',
  raritySuper: 'rgba(124, 58, 237, 0.45)',
  rarityUltra: 'rgba(138, 109, 11, 0.55)',
  raritySecret1: 'rgba(194, 24, 91, 0.4)',
  raritySecret2: 'rgba(14, 116, 144, 0.3)',
};

/**
 * Constantes de forme et de rythme, communes aux deux thèmes.
 * Les biseaux sont simulés par des carrés pivotés (React Native n'a pas de
 * `clip-path`) — voir components/Bevel.tsx.
 */
export const shape = {
  /** Biseau d'un panneau */
  bevelPanel: 18,
  /** Biseau d'une tuile de carte */
  bevelTile: 14,
  /** Biseau d'une puce ou d'un badge */
  bevelChip: 6,
  /** Décalage de la couche d'ombre des boutons */
  buttonOffset: 5,
  /** Plancher tactile */
  hitSlop: 44,
} as const;

export const type = {
  /** Interlettrage des libellés en majuscules */
  tracking: 1.2,
  trackingWide: 2,
} as const;

/**
 * Tokens de motion — durations et easings partages avec le web.
 * Reanimated : `Easing.bezier(a, b, c, d)` pour recréer les cubic-bezier CSS.
 */
export const motion = {
  fast: 180,
  mid: 320,
  slow: 600,
  lag: 1200,
  /** Cubic-bezier (.2, .8, .2, 1) — l'easing "confiant" par defaut */
  easing: [0.2, 0.8, 0.2, 1] as const,
  easingIn: [0.4, 0, 1, 1] as const,
  easingOut: [0, 0, 0.2, 1] as const,
} as const;

/**
 * Spacing selon la grille 8 (charte §7.2).
 */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

export type ThemeName = 'dark' | 'light';

export const palettes: Record<ThemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};
