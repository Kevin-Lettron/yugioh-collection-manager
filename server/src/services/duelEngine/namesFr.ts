import { query } from '../../config/database';

/**
 * Chargement des noms français des cartes depuis PostgreSQL.
 *
 * Le moteur utilise `cards.cdb` (ProjectIgnis / BabelCDB) qui ne porte que les
 * noms anglais. Notre base PG dispose d'une table `cards` avec `card_id` (le
 * passcode, stocké en texte) et `name_fr` (nullable) — quand une traduction
 * existe, on la préfère au libellé EN dans toutes les invites, les journaux
 * et le hover.
 *
 * Le module est appelé depuis le worker moteur au boot. `pg` fonctionne dans
 * un worker_thread : le pool est instancié séparément par worker, mais les
 * variables d'environnement sont héritées, donc la connexion est identique
 * à celle du fil principal.
 *
 * Si le chargement échoue (PG inaccessible, table absente en dev), le duel
 * DOIT rester jouable : on retourne alors un Map vide, tout retombe sur le
 * nom EN. Aucun `throw` n'est propagé au caller.
 *
 * `console.warn` — pas `logger.warn` — parce que `logger.ts` désactive
 * `DbTransport` hors du fil principal ; les warns du worker doivent tout de
 * même partir sur stderr (que PM2 capte).
 */

let cache: Map<number, string> | null = null;

/**
 * Charge le mapping passcode → nom_fr en une passe.
 *
 * Idempotent : le cache est renvoyé tel quel dès le deuxième appel. Une seule
 * requête, ~14 700 lignes filtrées côté SQL — quelques dizaines de ms.
 */
export async function loadNamesFrFromDb(): Promise<Map<number, string>> {
  if (cache) return cache;

  const map = new Map<number, string>();
  try {
    const result = await query(
      `SELECT card_id, name_fr FROM cards WHERE name_fr IS NOT NULL AND card_id IS NOT NULL`
    );
    for (const row of result.rows as Array<{ card_id: string | number; name_fr: string }>) {
      const code = Number(row.card_id);
      if (!Number.isFinite(code) || code <= 0) continue;
      const nameFr = typeof row.name_fr === 'string' ? row.name_fr.trim() : '';
      if (!nameFr) continue;
      map.set(code, nameFr);
    }
  } catch (err) {
    // Fallback silencieux : le duel doit rester jouable en EN si la DB n'est
    // pas jointe. `console.warn` direct — cf. commentaire d'en-tête sur
    // l'incompatibilité `logger.ts` + worker_thread.
    // eslint-disable-next-line no-console
    console.warn(
      `[duel:namesFr] chargement des noms FR indisponible, fallback EN — ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  cache = map;
  return map;
}

/** Retourne le nom FR déjà chargé, ou `undefined` si aucun n'est connu. */
export function nameFrOf(code: number): string | undefined {
  return cache?.get(code);
}

/** Réinitialise le cache — utilisé uniquement dans les tests. */
export function __resetNamesFrCacheForTests(): void {
  cache = null;
}
