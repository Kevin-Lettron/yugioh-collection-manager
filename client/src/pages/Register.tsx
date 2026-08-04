import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import { GlyphEye } from '../components/decor/Glyphs';
import { MillenniumMark } from '../components/decor/Icons';
import PasswordField from '../components/PasswordField';

const CUT_BTN = 'polygon(0 0,100% 0,100% 100%,95% 100%,95% 90%,85% 90%,85% 100%,8% 100%,0 70%)';
const CUT_SM = 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)';
const CUT_PANEL = 'polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))';
const CUT_INPUT = 'polygon(0 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%)';

/**
 * Register — même bloc que Login, kicker « Nouveau gardien », 3 champs,
 * CTA « Sceller mon compte ». Pixel-perfect avec isLogin (DesktopFrame l.112-145).
 */
const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (username.length < 3) {
      toast.error("Le pseudo doit contenir au moins 3 caractères");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error('Adresse courriel invalide');
      return;
    }
    if (password.length < 6) {
      toast.error('Le sceau doit contenir au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      await register(username, email, password);
      toast.success('Compte scellé !');
      navigate('/collection');
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      label: 'Pseudo',
      value: username,
      set: setUsername,
      ph: 'kaiba_pa',
      type: 'text',
    },
    {
      label: 'Courriel',
      value: email,
      set: setEmail,
      ph: 'votre@email.com',
      type: 'email',
    },
    {
      label: 'Sceau',
      value: password,
      set: setPassword,
      ph: '••••••••',
      type: 'password',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        padding: '60px 16px',
        background: 'transparent',
        overflow: 'hidden',
      }}>
      <AppBackground />
      <CornerOrnaments />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 120,
          opacity: 0.4,
          pointerEvents: 'none',
        }}>
        <div
          style={{
            width: 54,
            height: 520,
            background: 'linear-gradient(180deg,rgba(58,46,28,1),rgba(11,9,6,0))',
            borderLeft: '1px solid rgba(245,197,24,.28)',
            borderRight: '1px solid rgba(245,197,24,.1)',
          }}
        />
        <div
          style={{
            width: 54,
            height: 520,
            background: 'linear-gradient(180deg,rgba(58,46,28,1),rgba(11,9,6,0))',
            borderLeft: '1px solid rgba(245,197,24,.28)',
            borderRight: '1px solid rgba(245,197,24,.1)',
          }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          maxWidth: 470,
          padding: '44px 46px 40px',
          background: 'linear-gradient(160deg,var(--panel),var(--bg))',
          border: '1px solid var(--border)',
          boxShadow: '0 40px 80px rgba(0,0,0,.6),0 0 60px rgba(245,197,24,.08)',
          clipPath: CUT_PANEL,
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MillenniumMark size={56} className="text-blue-600" title="Keitland" />
          <div
            style={{
              marginTop: 16,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: 'italic',
              fontSize: 11,
              letterSpacing: '0.3em',
              color: 'var(--gold)',
              textTransform: 'uppercase',
            }}>
            — Nouveau gardien —
          </div>
          <h1
            style={{
              margin: '8px 0 0',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text)',
            }}>
            Sceller
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fields.map((f) => (
            <label
              key={f.label}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 9,
                  letterSpacing: '0.2em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}>
                {f.label}
              </span>
              {f.type === 'password' ? (
                <PasswordField
                  value={f.value}
                  onChange={f.set}
                  placeholder={f.ph}
                  disabled={loading}
                  autoComplete="new-password"
                />
              ) : (
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.ph}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px 16px',
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
              )}
            </label>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              width: '100%',
              height: 54,
              position: 'relative',
              isolation: 'isolate',
              border: 0,
              background: 'transparent',
              color: 'var(--bg)',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}>
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--violet)',
                transform: 'translate(5px,0)',
                clipPath: CUT_BTN,
                zIndex: -1,
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                background: 'var(--gold)',
                clipPath: CUT_BTN,
                zIndex: -1,
              }}
            />
            {loading ? 'Scellement...' : 'Sceller mon compte'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '8px 0',
            }}>
            <span
              style={{
                flex: 1,
                height: 1,
                background: 'linear-gradient(90deg,transparent,var(--border))',
              }}
            />
            <GlyphEye style={{ width: 18, height: 18, color: 'var(--gold-dim)' }} />
            <span
              style={{
                flex: 1,
                height: 1,
                background: 'linear-gradient(90deg,var(--border),transparent)',
              }}
            />
          </div>

          <button
            type="button"
            style={{
              width: '100%',
              height: 48,
              border: '1px solid var(--border)',
              background: 'var(--bg-elev)',
              color: 'var(--text-muted)',
              fontFamily: "'Orbitron', sans-serif",
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              clipPath: CUT_SM,
            }}
            onClick={() => toast('Discord OAuth arrive bientôt', { icon: '⏳' })}>
            Sceller avec Discord
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Déjà un gardien ? </span>
          <Link
            to="/login"
            style={{
              color: 'var(--gold)',
              textDecoration: 'none',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
            Entrer
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
