/**
 * Jeu d'icônes maison — grille 24, trait 1,6, angles vifs (aucun arrondi).
 * Les angles nets raccordent les icônes aux biseaux des boutons et panneaux.
 *
 * Toutes héritent de la couleur du contexte via `currentColor` : jamais de
 * couleur en dur, jamais d'icône multicolore. Voir docs/maquette-cyberpunk.html §4.
 *
 * Les motifs Yu-Gi-Oh sont des dessins originaux : la pyramide inversée à
 * anneaux évoque le Puzzle du Millénium sans reprendre d'asset Konami.
 */

interface IconProps {
  size?: number;
  className?: string;
  title?: string;
}

const base = (size: number, className: string) => ({
  width: size,
  height: size,
  className,
  fill: 'none' as const,
  stroke: 'currentColor' as const,
  strokeLinejoin: 'miter' as const,
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

/** Marque du produit : pyramide inversée + œil géométrique. */
export const MillenniumMark = ({ size = 24, className = '', title }: IconProps) => (
  <svg viewBox="0 0 32 32" {...base(size, className)} aria-hidden={!title} role={title ? 'img' : undefined}>
    {title && <title>{title}</title>}
    <path d="M4 4 L28 4 L16 29 Z" strokeWidth="1.7" />
    <path d="M9 10 L23 10 L16 24 Z" strokeWidth="0.8" opacity="0.55" />
    <ellipse cx="16" cy="13" rx="5.4" ry="3.1" strokeWidth="1.3" />
    <circle cx="16" cy="13" r="1.7" fill="currentColor" stroke="none" />
    <path d="M16 16.5 L16 20 M13 16 L11.5 19 M19 16 L20.5 19" strokeWidth="0.9" />
  </svg>
);

export const CardIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M5 3 H16 L19 6 V21 H5 Z" strokeWidth="1.6" />
    <path d="M8 8 H16 M8 12 H16 M8 16 H13" strokeWidth="1.2" />
  </svg>
);

export const DeckIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M3 7 H14 L17 10 V21 H3 Z" strokeWidth="1.6" />
    <path d="M7 4 H18 L21 7 V17" strokeWidth="1.2" opacity="0.6" />
  </svg>
);

export const ScanIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M3 8 V3 H8 M16 3 H21 V8 M21 16 V21 H16 M8 21 H3 V16" strokeWidth="1.7" />
    <path d="M3 12 H21" strokeWidth="1.4" />
  </svg>
);

export const SocialIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <circle cx="7" cy="7" r="2.6" strokeWidth="1.5" />
    <circle cx="17" cy="17" r="2.6" strokeWidth="1.5" />
    <circle cx="17" cy="6" r="2" strokeWidth="1.2" opacity="0.6" />
    <path d="M9 9 L15 15 M9 6 H15" strokeWidth="1.3" />
  </svg>
);

export const SearchIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M11 4 L17 10 L11 16 L5 10 Z" strokeWidth="1.6" />
    <path d="M15 14 L20 19" strokeWidth="1.8" />
  </svg>
);

export const FilterIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M3 4 H21 L14 12 V20 L10 18 V12 Z" strokeWidth="1.6" />
  </svg>
);

export const AddIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M12 2 L22 12 L12 22 L2 12 Z" strokeWidth="1.5" />
    <path d="M12 8 V16 M8 12 H16" strokeWidth="1.8" />
  </svg>
);

export const AlertIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M12 3 L22 20 H2 Z" strokeWidth="1.6" />
    <path d="M12 9 V14" strokeWidth="1.8" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CheckIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" strokeWidth="1.5" />
    <path d="M8 12 L11 15 L16 9" strokeWidth="1.9" />
  </svg>
);

export const MoonIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M20 14.5 A8.5 8.5 0 0 1 9.5 4 A8.5 8.5 0 1 0 20 14.5 Z" strokeWidth="1.6" />
  </svg>
);

export const SunIcon = ({ size = 24, className = '' }: IconProps) => (
  <svg viewBox="0 0 24 24" {...base(size, className)}>
    <path d="M12 6 L16 12 L12 18 L8 12 Z" strokeWidth="1.6" />
    <path d="M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23 M4.2 4.2 L6.3 6.3 M17.7 17.7 L19.8 19.8 M4.2 19.8 L6.3 17.7 M17.7 6.3 L19.8 4.2" strokeWidth="1.3" />
  </svg>
);
