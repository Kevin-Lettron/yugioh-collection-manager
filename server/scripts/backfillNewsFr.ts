/**
 * Backfill des trads FR sur les news deja en base (post-migration 008).
 * Boucle sur `translatePendingArticles` jusqu'a ce qu'il n'y ait plus rien
 * a traduire, avec bilan par lot.
 *
 * Usage : cd server && npx ts-node scripts/backfillNewsFr.ts
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { query } from '../src/config/database';
import { translatePendingArticles } from '../src/services/news/translate';

async function main() {
  console.log('\n=== Backfill trads FR des news ===\n');

  const before = await query(`SELECT COUNT(*)::int AS n FROM news_items WHERE title_fr IS NULL`);
  console.log(`${before.rows[0].n} article(s) sans trad FR.\n`);

  let round = 0;
  let totalOk = 0;
  let totalKo = 0;

  while (true) {
    round++;
    const { ok, ko } = await translatePendingArticles(30);
    if (ok === 0 && ko === 0) {
      console.log(`\n=== Termine — plus rien a traduire ===`);
      break;
    }
    totalOk += ok;
    totalKo += ko;
    console.log(`Lot #${round} : ${ok} ✓  ${ko} ✗  (total : ${totalOk} traduits)`);
  }

  const after = await query(
    `SELECT COUNT(*)::int AS translated FROM news_items WHERE title_fr IS NOT NULL`
  );
  console.log(`\nBilan : ${after.rows[0].translated} articles avec trad FR, ${totalKo} echec(s).\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal :', err);
  process.exit(1);
});
