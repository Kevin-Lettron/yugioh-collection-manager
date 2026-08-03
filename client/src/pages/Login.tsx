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
 * Login — pixel-perfect mockup `isLogin` (DesktopFrame l.112-145).
 * Panneau centré 470px biseauté 22px, deux obélisques d'ambiance,
 * logo Millennium 56px, kicker italique, CTA « Franchir le seuil » or/violet.
 */
const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      await login(identifier, password);
      toast.success('Bon retour parmi nous !');
      navigate('/collection');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Deux obélisques d'ambiance */}
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
          <MillenniumMark
            size={56}
            className="text-blue-600"
            title="Keitland"
          />
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
            — Retour au sanctuaire —
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
            Entrer
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
              Courriel ou pseudo
            </span>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="kaiba_pa"
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
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}>
              Sceau
            </span>
            <PasswordField
              value={password}
              onChange={setPassword}
              disabled={loading}
              autoComplete="current-password"
            />
          </label>

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
            {loading ? 'Ouverture...' : 'Franchir le seuil'}
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
            onClick={() =>
              toast('Discord OAuth arrive bientôt', { icon: '⏳' })
            }>
            Continuer avec Discord
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nouveau gardien ? </span>
          <Link
            to="/register"
            style={{
              color: 'var(--gold)',
              textDecoration: 'none',
              fontFamily: "'Orbitron', sans-serif",
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
            Sceller un compte
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
