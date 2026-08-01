interface Props {
  kicker?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}

/**
 * Titre de page selon la charte v2. Kicker italique Cormorant, titre uppercase
 * Orbitron avec gradient blanc → or, sous-titre optionnel.
 */
export function HeroTitle({ kicker, title, sub, className = '' }: Props) {
  return (
    <div className={`space-y-2 ${className}`}>
      {kicker && (
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: 'italic',
            fontSize: 12,
            letterSpacing: '0.3em',
            color: 'var(--gold)',
            textTransform: 'uppercase',
          }}>
          {kicker}
        </div>
      )}
      <h1
        style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 900,
          letterSpacing: '0.04em',
          lineHeight: 0.95,
          textTransform: 'uppercase',
          background: 'linear-gradient(180deg, var(--text) 0%, var(--gold-dim) 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter: 'drop-shadow(0 0 20px rgba(245, 197, 24, 0.15))',
          margin: 0,
        }}>
        {title}
      </h1>
      {sub && (
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-muted)',
            maxWidth: '60ch',
            margin: '4px 0 0',
          }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default HeroTitle;
