import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import AppBackground from '../components/decor/AppBackground';
import CornerOrnaments from '../components/decor/CornerOrnaments';
import HeroTitle from '../components/decor/HeroTitle';

const labelStyle: React.CSSProperties = {
  fontFamily: "'Orbitron', sans-serif",
  fontSize: 11,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (username.length < 3) {
      toast.error('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error('Veuillez entrer une adresse email valide');
      return;
    }

    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password);
      toast.success('Compte créé avec succès !');
      navigate('/collection');
    } catch (error: any) {
      // Error is handled by the API interceptor
      console.error('Registration failed:', error);
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
            kicker="— Nouveau Gardien —"
            title="Ouvrir son temple"
            sub="Trente secondes. Aucune carte bancaire."
            className="text-center"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block mb-2" style={labelStyle}>
              Nom d'utilisateur
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="Choisissez un nom d'utilisateur"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block mb-2" style={labelStyle}>
              Adresse email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="votre@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-2" style={labelStyle}>
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="Au moins 6 caractères"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block mb-2" style={labelStyle}>
              Confirmer le mot de passe
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 outline-none cyber-input transition"
              placeholder="Entrez à nouveau votre mot de passe"
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
            Ouvrir mon temple
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Déjà un gardien ?{' '}
            <Link
              to="/login"
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
              Entrer
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
