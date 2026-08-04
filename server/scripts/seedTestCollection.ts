/**
 * Seed collection de test pour un user donne (par defaut KEVINTEST).
 * Cherche 60 cartes main deck + 22 extra deck via YGOProDeck, upsert en `cards`,
 * puis add_to_collection avec quantite variable (certains staples en 4x).
 *
 * Usage :
 *   npx ts-node scripts/seedTestCollection.ts               (KEVINTEST par defaut)
 *   npx ts-node scripts/seedTestCollection.ts keitoNagayami (autre username)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { query } from '../src/config/database';
import { YGOProDeckService } from '../src/services/ygoprodeckService';
import { CardModel } from '../src/models/cardModel';
import { UserCardModel } from '../src/models/userCardModel';

import { MAIN_SEEDS as MAIN, EXTRA_SEEDS as EXTRA, type Seed } from './seedCardList';

// La liste vit desormais dans seedCardList.ts : seedAllUsers.ts en a besoin
// aussi, et deux copies auraient diverge a la premiere modification.

async function findUserByUsername(username: string): Promise<{ id: number; username: string } | null> {
  const res = await query('SELECT id, username FROM users WHERE username = $1 LIMIT 1', [username]);
  return res.rows[0] || null;
}

async function seedOne(userId: number, seed: Seed, index: number, total: number) {
  const apiCard = await YGOProDeckService.getCardByName(seed.name);
  if (!apiCard) {
    console.log(`  [${index}/${total}] ✗ INTROUVABLE : ${seed.name}`);
    return { ok: false as const, name: seed.name };
  }

  const dbCard = await CardModel.upsert(apiCard);
  const firstSet = apiCard.card_sets?.[0];
  const setCode = firstSet?.set_code || dbCard.card_id;
  const rarity = firstSet?.set_rarity || 'Common';

  await UserCardModel.addToCollection(userId, dbCard.id, setCode, rarity, seed.qty, 'EN');
  console.log(`  [${index}/${total}] ✓ ${seed.name.padEnd(45)} · ${setCode.padEnd(14)} · ${rarity.padEnd(20)} · x${seed.qty}`);
  return { ok: true as const, name: seed.name, setCode, rarity, qty: seed.qty };
}

async function main() {
  const targetUsername = process.argv[2] || 'KEVINTEST';
  console.log(`\n=== Seed collection de test → user "${targetUsername}" ===\n`);

  const user = await findUserByUsername(targetUsername);
  if (!user) {
    console.error(`✗ User "${targetUsername}" introuvable en base.`);
    process.exit(1);
  }
  console.log(`User trouvé : id=${user.id}, username=${user.username}\n`);

  const all = [...MAIN, ...EXTRA];
  const total = all.length;
  console.log(`Chargement de ${total} cartes (60 main + 22 extra)…\n`);

  const results = { ok: 0, ko: 0, misses: [] as string[] };
  for (let i = 0; i < all.length; i++) {
    try {
      const r = await seedOne(user.id, all[i], i + 1, total);
      if (r.ok) results.ok++;
      else {
        results.ko++;
        results.misses.push(r.name);
      }
    } catch (err: any) {
      results.ko++;
      results.misses.push(all[i].name);
      console.log(`  [${i + 1}/${total}] ✗ ERREUR ${all[i].name} : ${err?.message || err}`);
    }
    // Politesse envers YGOProDeck : 100 ms entre les appels
    await new Promise((r) => setTimeout(r, 120));
  }

  console.log(`\n=== Bilan ===`);
  console.log(`  ${results.ok}/${total} cartes ajoutées`);
  if (results.ko > 0) {
    console.log(`  ${results.ko} echec(s) :`);
    for (const m of results.misses) console.log(`    - ${m}`);
  }

  const finalCount = await query('SELECT COUNT(*) AS c, SUM(quantity) AS q FROM user_cards WHERE user_id = $1', [user.id]);
  console.log(`\nCollection "${user.username}" : ${finalCount.rows[0].c} lignes · ${finalCount.rows[0].q} cartes totales.\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal :', err);
  process.exit(1);
});
