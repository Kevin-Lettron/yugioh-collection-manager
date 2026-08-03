import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_URL } from '@/config';
import { storage } from '@/services/storage';
import { TOKEN_KEY } from '@/services/api';

/**
 * Remontée des crashs JS vers les logs serveur (`POST /api/client-errors`).
 *
 * Volontairement basé sur `fetch` et non sur l'instance axios : au moment d'un
 * crash, l'état du module `api` (intercepteurs, handler 401) peut faire partie
 * du problème. Moins il y a de code entre l'erreur et l'envoi, mieux c'est.
 */

/** Empêche la boucle : une erreur pendant l'envoi ne doit pas relancer un envoi. */
let reporting = false;

/** Dernière signature envoyée, pour ne pas inonder sur une erreur en boucle de rendu. */
let lastSignature = '';
let lastSentAt = 0;

interface CrashPayload {
  message: string;
  stack?: string;
  isFatal?: boolean;
  screen?: string;
  context?: Record<string, unknown>;
}

export async function reportCrash(payload: CrashPayload): Promise<void> {
  if (reporting) return;

  // Même erreur dans les 10 s : on ne renvoie pas. Une boucle de rendu peut
  // lever des centaines de fois par seconde.
  const signature = `${payload.message}|${(payload.stack || '').slice(0, 200)}`;
  const now = Date.now();
  if (signature === lastSignature && now - lastSentAt < 10_000) return;

  reporting = true;
  try {
    let token: string | null = null;
    try {
      token = await storage.getItem(TOKEN_KEY);
    } catch {
      /* stockage inaccessible : on rapporte en anonyme */
    }

    await fetch(`${API_URL}/api/client-errors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        source: 'mobile',
        platform: `${Platform.OS} ${Platform.Version}`,
        appVersion: Constants.expoConfig?.version ?? 'inconnue',
        ...payload,
      }),
    });

    lastSignature = signature;
    lastSentAt = now;
  } catch {
    // Le réseau est peut-être la cause du crash : on abandonne en silence.
  } finally {
    reporting = false;
  }
}

/**
 * Branche le handler global de React Native. Il capte les exceptions non
 * rattrapées hors rendu (callbacks, promesses, natif → JS).
 *
 * Les erreurs *de rendu* ne passent pas par ici : elles sont interceptées par
 * l'ErrorBoundary, qui appelle `reportCrash` de son côté.
 */
export function installCrashReporter(): void {
  // `ErrorUtils` est un global React Native, non typé par défaut.
  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler();

  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    reportCrash({
      message: error?.message || String(error),
      stack: error?.stack,
      isFatal: !!isFatal,
    });

    // On rend la main au handler d'origine : sans ça, l'écran rouge en dev
    // disparaît et le crash devient invisible pendant le développement.
    previousHandler?.(error, isFatal);
  });
}
