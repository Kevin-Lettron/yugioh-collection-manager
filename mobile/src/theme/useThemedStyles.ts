import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useAppTheme, type Theme } from './ThemeContext';

/**
 * Construit une feuille de styles dépendante du thème, mémoïsée tant que le
 * thème ne change pas.
 *
 * `StyleSheet.create` n'accepte pas d'objet dynamique typé de façon générique
 * sans perdre l'inférence, d'où la contrainte sur `T`.
 *
 *     const styles = useThemedStyles(makeStyles);
 *
 *     const makeStyles = (t: Theme) => StyleSheet.create({
 *       container: { flex: 1, backgroundColor: t.colors.bg },
 *     });
 *
 * `makeStyles` doit être défini **hors du composant** : une fonction recréée à
 * chaque rendu invaliderait la mémoïsation à chaque fois.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  makeStyles: (theme: Theme) => T
): T {
  const theme = useAppTheme();
  return useMemo(() => makeStyles(theme), [makeStyles, theme]);
}
