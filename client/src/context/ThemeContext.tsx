import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'keitland-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** true si le thème vient du réglage système faute de choix explicite */
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Lit la préférence au premier rendu, sans passer par un effet : évite le flash
 * de thème clair au chargement. `localStorage` peut lever (mode privé Safari,
 * cookies bloqués), d'où le try/catch.
 */
function readStoredTheme(): { theme: Theme; isSystem: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return { theme: stored, isSystem: false };
    }
  } catch {
    /* stockage indisponible : on retombe sur le réglage système */
  }

  const prefersLight =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: light)').matches;

  // Le sombre est le thème par défaut du produit, pas seulement un repli.
  return { theme: prefersLight ? 'light' : 'dark', isSystem: true };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [{ theme, isSystem }, setState] = useState(readStoredTheme);

  // L'attribut sur <html> pilote tous les tokens de theme.css.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Cohérence de la barre d'état sur mobile.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0906' : '#f7f3ea');
  }, [theme]);

  // Tant que l'utilisateur n'a rien choisi, on suit le réglage système en direct.
  useEffect(() => {
    if (!isSystem || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event: MediaQueryListEvent) => {
      setState({ theme: event.matches ? 'light' : 'dark', isSystem: true });
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [isSystem]);

  const setTheme = useCallback((next: Theme) => {
    setState({ theme: next, isSystem: false });
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* préférence non persistée, mais appliquée pour la session */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setState((prev) => {
      const next: Theme = prev.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* idem */
      }
      return { theme: next, isSystem: false };
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, isSystem }),
    [theme, setTheme, toggleTheme, isSystem]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme doit être utilisé dans un <ThemeProvider>');
  }
  return context;
}
