/**
 * Sorties d'extensions TCG — prochaines et récentes.
 *
 * YGOProDeck expose la liste complète des sets et leur date TCG via
 * `/cardsets.php`. On la garde 6 heures en mémoire : la donnée bouge une
 * ou deux fois par mois, et la page Actualités serait autrement le premier
 * client à ralentir l'API pour rien.
 */

import axios from 'axios';

const API_BASE_URL = process.env.YGOPRODECK_API_URL || 'https://db.ygoprodeck.com/api/v7';

/** Une extension telle qu'exposée par YGOProDeck (champs utiles seulement). */
export interface ReleaseRow {
  set_code: string;
  set_name: string;
  tcg_date: string; // ISO "YYYY-MM-DD"
  num_of_cards: number;
}

interface RawSet {
  set_name?: string;
  set_code?: string;
  num_of_cards?: number;
  tcg_date?: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 heures
let cache: RawSet[] | null = null;
let cachedAt = 0;

const releasesHttp = axios.create({ timeout: 5_000 });

async function fetchAllSets(): Promise<RawSet[]> {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) return cache;

  try {
    const res = await releasesHttp.get(`${API_BASE_URL}/cardsets.php`);
    if (Array.isArray(res.data)) {
      cache = res.data as RawSet[];
      cachedAt = now;
      return cache;
    }
    return cache ?? [];
  } catch (err) {
    // Un serveur qui tombe ne doit pas vider la page : on garde le vieux
    // cache si on en a un, sinon on renvoie une liste vide.
    console.error('[news:releases] fetch cardsets.php KO —', err instanceof Error ? err.message : err);
    return cache ?? [];
  }
}

/** Convertit `YYYY-MM-DD` en Date "à minuit local", tolère les null. */
function parseTcgDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  // On force l'heure à midi UTC pour éviter les décalages fuseau qui
  // feraient sauter une carte d'un jour à l'autre.
  const d = new Date(`${raw}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isReleaseRow(s: RawSet): s is Required<Pick<RawSet, 'set_code' | 'set_name' | 'tcg_date' | 'num_of_cards'>> {
  return typeof s.set_code === 'string'
    && typeof s.set_name === 'string'
    && typeof s.tcg_date === 'string'
    && typeof s.num_of_cards === 'number';
}

function toRow(s: RawSet): ReleaseRow {
  return {
    set_code: s.set_code as string,
    set_name: s.set_name as string,
    tcg_date: s.tcg_date as string,
    num_of_cards: (s.num_of_cards as number) ?? 0,
  };
}

/**
 * Sorties à venir dans les `days` prochains jours (aujourd'hui inclus).
 * Triées par date ascendante — la prochaine sortie apparaît en premier.
 */
export async function getUpcomingReleases(days: number = 90): Promise<ReleaseRow[]> {
  const sets = await fetchAllSets();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  return sets
    .filter(isReleaseRow)
    .filter((s) => {
      const d = parseTcgDate(s.tcg_date);
      return d !== null && d >= today && d <= horizon;
    })
    .map(toRow)
    .sort((a, b) => a.tcg_date.localeCompare(b.tcg_date));
}

/**
 * Sorties des `days` derniers jours, tri descendant — la plus récente en tête.
 */
export async function getRecentReleases(days: number = 30): Promise<ReleaseRow[]> {
  const sets = await fetchAllSets();
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  const floor = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

  return sets
    .filter(isReleaseRow)
    .filter((s) => {
      const d = parseTcgDate(s.tcg_date);
      return d !== null && d >= floor && d <= today;
    })
    .map(toRow)
    .sort((a, b) => b.tcg_date.localeCompare(a.tcg_date));
}
