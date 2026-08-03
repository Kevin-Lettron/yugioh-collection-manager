/**
 * Récupération d'un flux, avec les garde-fous qui évitent de se faire bannir.
 *
 * Trois précautions, toutes issues du relevé de sources : Reddit répond **429
 * dès le deuxième appel rapproché**, et un agrégateur anonyme qui martèle un
 * site finit bloqué. On s'identifie, on limite la taille, on abandonne vite.
 */

/** Un agrégateur doit dire qui il est. Un UA de navigateur serait un mensonge. */
const USER_AGENT =
  'KeitlandBot/1.0 (+https://keitland.eu ; agrégateur d\'actualités Yu-Gi-Oh)';

/** Au-delà, ce n'est plus un flux : on coupe plutôt que de charger la mémoire. */
const MAX_BYTES = 4 * 1024 * 1024;

const TIMEOUT_MS = 20_000;

export interface FetchResult {
  body: string;
  contentType: string | null;
}

export async function fetchFeed(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'fr, en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      // 429 et 403 méritent d'être nommés : ce sont des refus, pas des pannes,
      // et ils appellent une réaction différente (ralentir, pas réessayer).
      const hint =
        res.status === 429
          ? ' — cadence trop rapide pour cette source'
          : res.status === 403
            ? ' — accès refusé (protection anti-robot ?)'
            : '';
      throw new Error(`HTTP ${res.status} ${res.statusText}${hint}`);
    }

    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
      throw new Error(`flux trop volumineux (${Math.round(length / 1024)} Ko)`);
    }

    const body = await res.text();
    if (body.length > MAX_BYTES) {
      throw new Error(`flux trop volumineux (${Math.round(body.length / 1024)} Ko)`);
    }
    if (!body.trim()) {
      throw new Error('réponse vide');
    }

    return { body, contentType: res.headers.get('content-type') };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`délai dépassé (${TIMEOUT_MS / 1000} s)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
