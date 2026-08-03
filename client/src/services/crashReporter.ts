const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Remontée des erreurs du client web vers les logs serveur
 * (`POST /api/client-errors`).
 *
 * Jusqu'ici le web se contentait d'un toast « Une erreur est survenue » : rien
 * n'était conservé, et diagnostiquer supposait de reproduire le problème
 * l'inspecteur ouvert. Le pendant mobile existe déjà, cette route est commune.
 *
 * Volontairement sur `fetch` et non sur l'instance axios : l'intercepteur de
 * cette instance est justement ce qui déclenche l'envoi, et s'en servir
 * créerait une boucle.
 */

/** Coupe la récursion : une erreur pendant l'envoi ne relance pas d'envoi. */
let sending = false;

/** Dernière signature envoyée, pour ne pas inonder sur une erreur répétée. */
let lastSignature = '';
let lastSentAt = 0;

interface ReportPayload {
  message: string;
  stack?: string;
  screen?: string;
  context?: Record<string, unknown>;
  isFatal?: boolean;
}

export function reportClientError(payload: ReportPayload): void {
  if (sending) return;

  // Une même erreur dans les 10 s n'est envoyée qu'une fois : une boucle de
  // rendu peut lever des dizaines de fois par seconde.
  const signature = `${payload.message}|${payload.screen || ''}`;
  const now = Date.now();
  if (signature === lastSignature && now - lastSentAt < 10_000) return;

  lastSignature = signature;
  lastSentAt = now;
  sending = true;

  const token = (() => {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  })();

  fetch(`${API_URL}/api/client-errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // `keepalive` permet à la requête de survivre à une navigation : sans ça,
    // une erreur suivie d'une redirection ne serait jamais transmise.
    keepalive: true,
    body: JSON.stringify({
      source: 'web',
      platform: navigator.userAgent.slice(0, 120),
      screen: payload.screen || window.location.pathname,
      ...payload,
    }),
  })
    .catch(() => {
      // Le réseau est peut-être la cause de l'erreur : on abandonne en silence.
    })
    .finally(() => {
      sending = false;
    });
}

/**
 * Erreurs JavaScript non rattrapées et promesses rejetées sans `catch`.
 * Les erreurs de rendu React ne passent pas par là — c'est le rôle de
 * l'ErrorBoundary.
 */
export function installWebCrashReporter(): void {
  window.addEventListener('error', (event) => {
    reportClientError({
      message: event.message || 'Erreur JS non rattrapée',
      stack: event.error?.stack,
      context: { file: event.filename, line: event.lineno, col: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    reportClientError({
      message: reason?.message || String(reason) || 'Promesse rejetée',
      stack: reason?.stack,
      context: { kind: 'unhandledrejection' },
    });
  });
}
