/**
 * Backfill des traductions FR officielles Konami sur toutes les cartes deja
 * en base. A lancer une fois apres la migration 006 pour hydrater name_fr
 * et description_fr pour toutes les cartes existantes.
 *
 * Usage : cd server && npx ts-node scripts/backfillFrTranslations.ts
 *
 * Rate-limite a 4 requetes/sec pour eviter les 429 de YGOProDeck.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import axios from 'axios';
import { query } from '../src/config/database';

const API = process.env.YGOPRODECK_API_URL || 'https://db.ygoprodeck.com/api/v7';
const http = axios.create({ timeout: 6000 });

async function fetchFr(id: string): Promise<{ name_fr: string; description_fr: string } | null> {
  try {
    const res = await http.get(`${API}/cardinfo.php`, { params: { id, language: 'fr' } });
    const d = res.data?.data?.[0];
    if (!d?.name || !d?.desc) return null;
    return { name_fr: d.name, description_fr: d.desc };
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n=== Backfill des trads FR ===\n');

  const cards = await query(
    'SELECT id, card_id, name FROM cards WHERE name_fr IS NULL ORDER BY id'
  );
  const total = cards.rows.length;
  console.log(`${total} cartes sans trad FR a hydrater.\n`);

  let ok = 0;
  let ko = 0;

  for (let i = 0; i < total; i++) {
    const c = cards.rows[i];
    const fr = await fetchFr(c.card_id);
    if (fr) {
      await query(
        'UPDATE cards SET name_fr = $1, description_fr = $2 WHERE id = $3',
        [fr.name_fr, fr.description_fr, c.id]
      );
      ok++;
      console.log(`  [${i + 1}/${total}] ✓ ${c.name.padEnd(40)} → ${fr.name_fr}`);
    } else {
      ko++;
      console.log(`  [${i + 1}/${total}] ✗ ${c.name} (pas de FR)`);
    }
    // Rate-limit : ~250ms entre les appels (4 req/s)
    await new Promise((r) => setTimeout(r, 260));
  }

  console.log(`\n=== Bilan : ${ok}/${total} trads FR ajoutees, ${ko} echec(s) ===\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal :', err);
  process.exit(1);
});
