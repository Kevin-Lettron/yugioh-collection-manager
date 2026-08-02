import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  /**
   * Anime le bouton en glitch au survol. Actif par défaut sauf sur `ghost` —
   * passer `glitch={false}` explicitement pour désactiver.
   */
  glitch?: boolean;
  /** Petite étiquette d'angle décorative (ex. « R25 »). */
  tag?: string;
  children: React.ReactNode;
}

/**
 * Bouton cyber — deux couches découpées au clip-path, la couche « ombre »
 * décalée de 5 px. Voir `.cyber-btn` dans src/styles/theme.css, et la charte
 * (docs/maquette-cyberpunk.html §5) pour le choix de la variante.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      // Glitch actif par défaut sauf ghost (ces boutons transparents restent sobres).
      glitch,
      tag,
      className = '',
      children,
      disabled,
      // Sans type explicite, un bouton dans un <form> le soumet au clic.
      // Le défaut sûr est `button` ; les appelants passent `submit` au besoin.
      type = 'button',
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      primary: '',
      secondary: 'cyber-btn--violet',
      danger: 'cyber-btn--danger',
      ghost: 'cyber-btn--ghost',
    };

    // Hauteurs minimales pensées pour le tactile (44 px est le plancher usuel).
    const sizeStyles = {
      sm: 'cyber-btn--sm px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm min-h-[44px]',
      lg: 'px-6 py-3 text-base min-h-[52px]',
    };

    const effectiveGlitch = glitch !== undefined ? glitch : variant !== 'ghost';
    const classes = [
      'cyber-btn',
      effectiveGlitch ? 'cyber-btn--glitch' : '',
      variantStyles[variant],
      sizeStyles[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {effectiveGlitch && <span className="cyber-btn__glitch" aria-hidden="true" />}
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Chargement…</span>
          </>
        ) : (
          children
        )}
        {tag && !isLoading && <span className="cyber-btn__tag">{tag}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
