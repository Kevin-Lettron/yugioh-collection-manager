import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { reportCrash } from '@/services/crashReporter';
import { darkPalette } from '@/theme/palette';

interface Props {
  children: ReactNode;
  /** Nom de l'écran ou de la zone, joint au rapport pour situer le crash. */
  screen?: string;
}

interface State {
  error: Error | null;
}

/**
 * Filet de sécurité sur les erreurs de rendu.
 *
 * Sans lui, une exception pendant le rendu démonte tout l'arbre React : sur un
 * build de production, l'app se ferme sans message — c'est le « s'arrête
 * systématiquement » d'Android. Ici on affiche l'erreur, on la remonte au
 * serveur, et on laisse la possibilité de réessayer.
 *
 * Doit rester une classe : `componentDidCatch` n'a pas d'équivalent en hook.
 * Les couleurs sont prises sur la palette sombre en dur, sans passer par le
 * contexte de thème : si c'est justement le provider qui a planté, un hook
 * relancerait l'erreur pendant l'affichage du repli.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportCrash({
      message: error?.message || 'Erreur de rendu',
      stack: error?.stack,
      isFatal: true,
      screen: this.props.screen,
      context: { componentStack: info?.componentStack?.slice(0, 1500) },
    });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>— Oracle silencieux —</Text>
          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.message}>{error.message || 'Erreur inconnue'}</Text>
          <Text style={styles.note}>
            Le détail a été envoyé aux logs du serveur. Tu peux réessayer.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ error: null })}
            accessibilityRole="button">
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>

          {__DEV__ && error.stack ? (
            <Text style={styles.stack}>{error.stack}</Text>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: darkPalette.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 12 },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: darkPalette.gold,
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: darkPalette.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: darkPalette.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  note: { fontSize: 12, color: darkPalette.textDim, textAlign: 'center', marginBottom: 8 },
  button: {
    alignSelf: 'center',
    minHeight: 48,
    paddingHorizontal: 26,
    justifyContent: 'center',
    backgroundColor: darkPalette.gold,
  },
  buttonText: {
    color: darkPalette.onGold,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 13,
  },
  stack: {
    marginTop: 18,
    fontSize: 10,
    color: darkPalette.textDim,
    fontFamily: 'monospace',
  },
});
