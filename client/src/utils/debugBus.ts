/**
 * Bus d'erreurs pour le débogueur à l'écran (cf. DebugErrorOverlay).
 *
 * On passe par un `CustomEvent` sur `window` plutôt qu'un module singleton,
 * pour deux raisons :
 *   - le crashReporter et l'intercepteur axios ne connaissent rien de React,
 *     et l'overlay se contente d'écouter ;
 *   - les erreurs peuvent survenir avant même que React ne monte
 *     (chargement d'un module, panne réseau au boot).
 *
 * Activation :
 *   - `?debug=1` en URL (persiste dans `localStorage`)
 *   - `?debug=0` désactive
 *   - `localStorage.keitlandDebug = 'on'` directement
 */

export interface DebugErrorEntry {
  id: string;
  ts: number;
  kind: 'http' | 'js' | 'promise' | 'react';
  title: string;
  detail?: string;
  stack?: string;
  meta?: Record<string, unknown>;
}

const DEBUG_KEY = 'keitlandDebug';
const EVENT_NAME = 'keitland:debug-error';

export function isDebugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') {
      localStorage.setItem(DEBUG_KEY, 'on');
      return true;
    }
    if (params.get('debug') === '0') {
      localStorage.removeItem(DEBUG_KEY);
      return false;
    }
    return localStorage.getItem(DEBUG_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setDebugEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(DEBUG_KEY, 'on');
    else localStorage.removeItem(DEBUG_KEY);
  } catch {
    /* localStorage indisponible : rien à faire */
  }
}

/**
 * Émet une entrée pour l'overlay. Toujours appelée, même quand le mode debug
 * est off : l'overlay filtre lui-même. Ça évite de trimballer un flag dans
 * tous les callers.
 */
export function pushDebugError(entry: Omit<DebugErrorEntry, 'id' | 'ts'>): void {
  try {
    const full: DebugErrorEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
    };
    window.dispatchEvent(new CustomEvent<DebugErrorEntry>(EVENT_NAME, { detail: full }));
  } catch {
    /* window absent (SSR) : rien à faire */
  }
}

export function onDebugError(cb: (entry: DebugErrorEntry) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<DebugErrorEntry>).detail);
  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}
