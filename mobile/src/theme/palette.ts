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
  cyan: string;
  magenta: string;
  success: string;
  danger: string;
  onGold: string;
  /** Voile des modales, posé par-dessus l'écran */
  scrim: string;
  /** Fond des zones caméra : du vrai noir, jamais thémé */
  camera: string;
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
  cyan: '#22D3EE',
  magenta: '#FF2E88',
  success: '#34D399',
  danger: '#FF4D6D',
  onGold: '#0B0906',
  scrim: 'rgba(0, 0, 0, 0.72)',
  camera: '#000000',
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
  cyan: '#0E7490',
  magenta: '#C2185B',
  success: '#047857',
  danger: '#BE123C',
  onGold: '#FFFFFF',
  scrim: 'rgba(26, 18, 6, 0.55)',
  camera: '#000000',
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

export type ThemeName = 'dark' | 'light';

export const palettes: Record<ThemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};
