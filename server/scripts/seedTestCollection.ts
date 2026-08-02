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

type Seed = { name: string; qty: number };

/**
 * Main deck : 30 monstres + 15 magies + 15 pieges = 60.
 * Certaines cartes sont en 4x (staples : Ash Blossom, Maxx "C", MST, etc.).
 */
const MAIN: Seed[] = [
  // Monstres (30)
  { name: 'Blue-Eyes White Dragon', qty: 3 },
  { name: 'Dark Magician', qty: 3 },
  { name: 'Red-Eyes Black Dragon', qty: 2 },
  { name: 'Exodia the Forbidden One', qty: 1 },
  { name: 'Left Arm of the Forbidden One', qty: 1 },
  { name: 'Right Arm of the Forbidden One', qty: 1 },
  { name: 'Left Leg of the Forbidden One', qty: 1 },
  { name: 'Right Leg of the Forbidden One', qty: 1 },
  { name: 'Ash Blossom & Joyous Spring', qty: 4 },
  { name: 'Effect Veiler', qty: 4 },
  { name: 'Maxx "C"', qty: 4 },
  { name: 'Ghost Ogre & Snow Rabbit', qty: 3 },
  { name: 'Nibiru, the Primal Being', qty: 2 },
  { name: 'Cyber Dragon', qty: 3 },
  { name: 'Elemental HERO Sparkman', qty: 2 },
  { name: 'Elemental HERO Neos', qty: 1 },
  { name: 'Elemental HERO Avian', qty: 1 },
  { name: 'Elemental HERO Burstinatrix', qty: 1 },
  { name: 'Buster Blader', qty: 1 },
  { name: 'Kuriboh', qty: 1 },
  { name: 'Winged Kuriboh', qty: 1 },
  { name: 'Sangan', qty: 1 },
  { name: 'Witch of the Black Forest', qty: 1 },
  { name: 'D.D. Crow', qty: 2 },
  { name: 'PSY-Framegear Gamma', qty: 2 },
  { name: 'Fossil Dyna Pachycephalo', qty: 1 },
  { name: 'Jinzo', qty: 1 },
  { name: 'Summoned Skull', qty: 2 },
  { name: 'Gemini Elf', qty: 1 },
  { name: 'Man-Eater Bug', qty: 1 },

  // Magies (15)
  { name: 'Pot of Greed', qty: 1 },
  { name: 'Monster Reborn', qty: 1 },
  { name: 'Raigeki', qty: 1 },
  { name: 'Dark Hole', qty: 1 },
  { name: 'Change of Heart', qty: 1 },
  { name: 'Mystical Space Typhoon', qty: 4 },
  { name: 'Book of Moon', qty: 3 },
  { name: 'Called by the Grave', qty: 3 },
  { name: 'Foolish Burial', qty: 2 },
  { name: 'Pot of Extravagance', qty: 3 },
  { name: 'Pot of Desires', qty: 3 },
  { name: 'Twin Twisters', qty: 4 },
  { name: 'Cosmic Cyclone', qty: 3 },
  { name: 'Terraforming', qty: 1 },
  { name: 'Reinforcement of the Army', qty: 1 },

  // Pieges (15)
  { name: 'Mirror Force', qty: 2 },
  { name: 'Solemn Judgment', qty: 1 },
  { name: 'Solemn Warning', qty: 3 },
  { name: 'Solemn Strike', qty: 3 },
  { name: 'Bottomless Trap Hole', qty: 3 },
  { name: 'Trap Hole', qty: 2 },
  { name: 'Torrential Tribute', qty: 2 },
  { name: 'Skill Drain', qty: 3 },
  { name: 'Compulsory Evacuation Device', qty: 3 },
  { name: 'Infinite Impermanence', qty: 4 },
  { name: 'Trap Trick', qty: 2 },
  { name: 'Imperial Order', qty: 1 },
  { name: "Vanity's Emptiness", qty: 2 },
  { name: 'Waboku', qty: 3 },
  { name: 'Magic Cylinder', qty: 2 },
];

/** Extra deck : 6 Fusion + 5 Synchro + 5 Xyz + 6 Link = 22. */
const EXTRA: Seed[] = [
  // Fusion
  { name: 'Blue-Eyes Ultimate Dragon', qty: 1 },
  { name: 'Dark Paladin', qty: 1 },
  { name: 'Elemental HERO Flame Wingman', qty: 1 },
  { name: 'Elemental HERO Neos Knight', qty: 1 },
  { name: 'Elemental HERO The Shining', qty: 1 },
  { name: 'Cyber End Dragon', qty: 1 },

  // Synchro
  { name: 'Stardust Dragon', qty: 2 },
  { name: 'Black Rose Dragon', qty: 1 },
  { name: 'Ancient Fairy Dragon', qty: 1 },
  { name: 'Junk Warrior', qty: 1 },
  { name: 'Formula Synchron', qty: 2 },

  // Xyz
  { name: 'Number 39: Utopia', qty: 2 },
  { name: 'Number 17: Leviathan Dragon', qty: 1 },
  { name: 'Steelswarm Roach', qty: 1 },
  { name: 'Number 41: Bagooska the Terribly Tired Tapir', qty: 1 },
  { name: 'Tornado Dragon', qty: 1 },

  // Link
  { name: 'Firewall Dragon', qty: 1 },
  { name: 'Decode Talker', qty: 1 },
  { name: 'Knightmare Phoenix', qty: 2 },
  { name: 'Knightmare Cerberus', qty: 2 },
  { name: 'Knightmare Unicorn', qty: 1 },
  { name: 'Accesscode Talker', qty: 1 },
];

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
