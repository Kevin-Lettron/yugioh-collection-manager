import { useTheme } from '../context/ThemeContext';
import { MoonIcon, SunIcon } from './decor/Icons';

/**
 * Bascule sombre / clair. Le libellé annonce la cible de l'action
 * (« Passer en clair ») et non l'état courant : c'est ce que l'utilisateur
 * obtient en cliquant, et ce qu'un lecteur d'écran doit annoncer.
 */
const ThemeToggle = ({ className = '' }: { className?: string }) => {
  const { theme, toggleTheme } = useTheme();
  const goingToLight = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`cyber-cut-sm flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 border border-gray-300 hover:border-blue-600 transition ${className}`}
      aria-label={goingToLight ? 'Passer en thème clair' : 'Passer en thème sombre'}
      title={goingToLight ? 'Passer en thème clair' : 'Passer en thème sombre'}
    >
      {goingToLight ? <SunIcon size={18} /> : <MoonIcon size={18} />}
      <span className="hidden sm:inline text-xs font-semibold uppercase tracking-widest">
        {goingToLight ? 'Clair' : 'Sombre'}
      </span>
    </button>
  );
};

export default ThemeToggle;
