import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import HeroTitle from '../components/decor/HeroTitle';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!identifier || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
      toast.success('Bon retour parmi nous !');
      navigate('/collection');
    } catch (error: any) {
      // Error is handled by the API interceptor
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-12">
      <AppBackground />
      <CornerOrnaments />

      <div
        className="relative z-20 w-full max-w-md cyber-panel p-8"
        style={{
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), var(--glow)',
        }}
      >
        <div className="text-center mb-8">
          <HeroTitle
            kicker="— Retour au Sanctuaire —"
            title="Entrer"
            sub="Reprends là où tu t'étais arrêté."
            className="text-center"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="identifier"
              className="block mb-2"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Email ou pseudo
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="votre@email.com ou pseudo"
              disabled={loading}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block mb-2"
              style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="Entrez votre mot de passe"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            glitch
            isLoading={loading}
            className="w-full"
          >
            Entrer dans le sanctuaire
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Pas encore de gardien ?{' '}
            <Link
              to="/register"
              style={{
                color: 'var(--gold)',
                textDecoration: 'none',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 12,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Ouvrir un temple
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
