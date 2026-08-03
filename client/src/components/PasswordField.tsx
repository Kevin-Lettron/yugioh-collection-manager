import { useState } from 'react';

const CUT_INPUT = 'polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  id?: string;
}

/**
 * Champ mot de passe avec bascule d'affichage.
 *
 * Le bouton est en dehors du flux de tabulation (`tabIndex={-1}`) : il ne doit
 * pas s'intercaler entre le champ et le bouton de validation quand on navigue
 * au clavier. Il reste atteignable à la souris et annoncé par les lecteurs
 * d'écran via `aria-label` + `aria-pressed`.
 */
const PasswordField = ({
  value,
  onChange,
  placeholder = '••••••••',
  disabled = false,
  autoComplete = 'current-password',
  id,
}: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          // Marge à droite pour ne pas passer sous le bouton œil
          padding: '14px 48px 14px 16px',
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderLeft: '2px solid var(--gold)',
          color: 'var(--text)',
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 16,
          outline: 'none',
          clipPath: CUT_INPUT,
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        aria-pressed={visible}
        title={visible ? 'Masquer' : 'Afficher'}
        style={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          background: 'transparent',
          border: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: visible ? 'var(--gold)' : 'var(--text-muted)',
          padding: 0,
        }}
      >
        {visible ? (
          // Œil barré — le mot de passe est visible, cliquer le masque
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M3 3 L21 21" strokeWidth="1.7" />
            <path
              d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 9 4.5 9 6 0 .8-1.1 2.4-2.9 3.8M6.6 8.3C4.7 9.7 3 11.3 3 12c0 1.5 4 6 9 6 1.2 0 2.3-.25 3.3-.65"
              strokeWidth="1.6"
            />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeWidth="1.6" />
          </svg>
        ) : (
          // Œil ouvert, dans le style géométrique de la charte
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M3 12 C6 7, 18 7, 21 12 C18 17, 6 17, 3 12 Z" strokeWidth="1.6" />
            <circle cx="12" cy="12" r="2.6" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default PasswordField;
