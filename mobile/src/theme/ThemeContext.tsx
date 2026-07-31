import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '@/services/storage';
import { palettes, shape, type, type Palette, type ThemeName } from './palette';

const STORAGE_KEY = 'keitland-theme';

export interface Theme {
  name: ThemeName;
  colors: Palette;
  shape: typeof shape;
  type: typeof type;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (name: ThemeName) => void;
  toggleTheme: () => void;
  /** true tant que l'utilisateur n'a pas choisi : on suit le réglage système */
  isSystem: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function buildTheme(name: ThemeName): Theme {
  return { name, colors: palettes[name], shape, type };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  // `null` = aucun choix explicite : le réglage système fait foi.
  const [chosen, setChosen] = useState<ThemeName | null>(null);

  // La lecture du stockage est asynchrone sur mobile ; en attendant, on affiche
  // le sombre (thème par défaut du produit), ce qui évite un flash clair.
  useEffect(() => {
    let cancelled = false;
    storage
      .getItem(STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && (stored === 'dark' || stored === 'light')) setChosen(stored);
      })
      .catch(() => {
        /* stockage indisponible : on reste sur le réglage système */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name: ThemeName = chosen ?? (systemScheme === 'light' ? 'light' : 'dark');

  const persist = useCallback((next: ThemeName) => {
    setChosen(next);
    storage.setItem(STORAGE_KEY, next).catch(() => {
      /* préférence appliquée pour la session, mais non persistée */
    });
  }, []);

  const toggleTheme = useCallback(() => {
    persist(name === 'dark' ? 'light' : 'dark');
  }, [name, persist]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: buildTheme(name),
      setTheme: persist,
      toggleTheme,
      isSystem: chosen === null,
    }),
    [name, persist, toggleTheme, chosen]
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

/** Raccourci quand seul l'objet thème est nécessaire. */
export function useAppTheme(): Theme {
  return useTheme().theme;
}
