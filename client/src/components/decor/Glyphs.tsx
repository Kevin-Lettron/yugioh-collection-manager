import type { CSSProperties } from 'react';

/**
 * Glyphes géométriques Sanctuaire — motifs égyptiens stylisés, grille 40,
 * `stroke: currentColor` pour hériter de la couleur du contexte.
 * Usage : décoration en background parallax, ornements de coin.
 */

interface Props {
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

export const GlyphEye = (p: Props) => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
    <ellipse cx="20" cy="20" rx="16" ry="9" />
    <circle cx="20" cy="20" r="5" />
    <circle cx="20" cy="20" r="2" fill="currentColor" />
  </svg>
);

export const GlyphPyramid = (p: Props) => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
    <path d="M20 4 L36 32 L4 32 Z" />
    <path d="M20 4 L20 32" opacity="0.5" />
    <path d="M10 22 L30 22" opacity="0.4" />
  </svg>
);

export const GlyphAnkh = (p: Props) => (
  <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
    <circle cx="20" cy="12" r="6" />
    <path d="M20 18 V36 M12 22 H28" />
  </svg>
);

/** Ornement de coin : cadre égyptien géométrique. */
export const CornerOrnament = (p: Props) => (
  <svg viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
    <path d="M0 0 L60 0 L60 4 L4 4 L4 60 L0 60 Z" />
    <path d="M10 10 L44 10 M10 10 L10 44" opacity="0.4" />
    <path d="M20 20 L34 20 L34 24 L24 24 L24 34 L20 34 Z" opacity="0.7" />
    <circle cx="12" cy="52" r="2" fill="currentColor" />
    <circle cx="52" cy="12" r="2" fill="currentColor" />
    <path d="M60 60 L70 60 L70 62 L62 62 L62 70 L60 70 Z" opacity="0.3" />
  </svg>
);
