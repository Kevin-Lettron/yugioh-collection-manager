/**
 * Garnit la collection de **tous** les utilisateurs avec les cartes de
 * `seedTestCollection.ts`, et donne à chacun le même deck légal.
 *
 *     npx ts-node scripts/seedAllUsers.ts
 *     npx ts-node scripts/seedAllUsers.ts --deck-only   (saute la collection)
 *
 * Deux choses à distinguer, et c'est tout l'intérêt du script :
 *
 *   - **la collection** accepte les quantités du fichier telles quelles, y
 *     compris les 4 exemplaires des staples. Posséder quatre Ash Blossom est
 *     parfaitement normal ;
 *   - **le deck** est soumis aux règles du jeu : 40 à 60 cartes principales,
 *     15 maximum en Extra, et **3 exemplaires maximum par carte**. Les entrées
 *     en 4x du fichier y sont donc plafonnées à 3.
 *
 * Les cartes ne sont résolues qu'une seule fois auprès de YGOProDeck, puis
 * réutilisées pour tous les utilisateurs : 81 appels réseau au lieu de 324.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { query } from '../src/config/database';
import { YGOProDeckService } from '../src/services/ygoprodeckService';
import { CardModel } from '../src/models/cardModel';
import { UserCardModel } from '../src/models/userCardModel';
import { MAIN_SEEDS, EXTRA_SEEDS, type Seed } from './seedCardList';

/** Taille visée du Main Deck. 40 est le minimum légal, et suffit pour jouer. */
const DECK_MAIN_SIZE = 40;
const DECK_EXTRA_SIZE = 15;
const MAX_COPIES = 3;

const DECK_NAME = 'Sanctuaire du Millénium';

interface ResolvedCard {
  seed: Seed;
  cardDbId: number;
  setCode: string;
  rarity: string;
  name: string;
}

/**
 * Résout une liste de noms en cartes de la base, en une passe.
 *
 * Les échecs ne sont pas fatals : une carte introuvable est signalée et écartée,
 * le reste continue. Un nom qui a changé côté YGOProDeck ne doit pas faire
 * échouer le garnissage de quatre collections.
 */
async function resolveAll(seeds: Seed[], label: string): Promise<ResolvedCard[]> {
  const out: ResolvedCard[] = [];
  const missing: string[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    try {
      const apiCard = await YGOProDeckService.getCardByName(seed.name);
      if (!apiCard) {
        missing.push(seed.name);
      } else {
        const dbCard = await CardModel.upsert(apiCard);
        const firstSet = apiCard.card_sets?.[0];
        out.push({
          seed,
          cardDbId: dbCard.id,
          setCode: firstSet?.set_code || dbCard.card_id,
          rarity: firstSet?.set_rarity || 'Common',
          name: seed.name,
        });
      }
    } catch (err) {
      missing.push(`${seed.name} (${err instanceof Error ? err.message : err})`);
    }

    if ((i + 1) % 10 === 0 || i === seeds.length - 1) {
      process.stdout.write(`\r  ${label} : ${i + 1}/${seeds.length} résolues`);
    }
    // Politesse envers YGOProDeck, qui est publique et gratuite.
    await new Promise((r) => setTimeout(r, 120));
  }

  process.stdout.write('\n');
  if (missing.length) {
    console.log(`  ⚠ ${missing.length} introuvable(s) : ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  }
  return out;
}

/**
 * Choisit les cartes du deck, dans l'ordre du fichier, en respectant les règles.
 *
 * Le plafond de 3 exemplaires s'applique **avant** le comptage : sans lui, un
 * deck de 40 cartes construit sur des entrées en 4x serait refusé par la
 * validation, et l'utilisateur découvrirait le problème en essayant de jouer.
 */
function pickDeckCards(
  cards: ResolvedCard[],
  targetSize: number
): Array<{ cardDbId: number; quantity: number; name: string }> {
  const picked: Array<{ cardDbId: number; quantity: number; name: string }> = [];
  let total = 0;

  for (const card of cards) {
    if (total >= targetSize) break;
    const quantity = Math.min(card.seed.qty, MAX_COPIES, targetSize - total);
    if (quantity <= 0) continue;
    picked.push({ cardDbId: card.cardDbId, quantity, name: card.name });
    total += quantity;
  }

  return picked;
}

async function fillCollection(userId: number, cards: ResolvedCard[]): Promise<number> {
  let added = 0;
  for (const c of cards) {
    // La collection garde les quantités du fichier : le plafond de 3 est une
    // règle de deck, pas de collection.
    await UserCardModel.addToCollection(userId, c.cardDbId, c.setCode, c.rarity, c.seed.qty, 'EN');
    added += c.seed.qty;
  }
  return added;
}

async function createDeck(
  userId: number,
  main: Array<{ cardDbId: number; quantity: number }>,
  extra: Array<{ cardDbId: number; quantity: number }>
): Promise<number> {
  // Un deck du même nom est remplacé : relancer le script ne doit pas empiler
  // les doublons.
  await query('DELETE FROM decks WHERE user_id = $1 AND name = $2', [userId, DECK_NAME]);

  const deck = await query(
    `INSERT INTO decks (user_id, name, is_public, respect_banlist)
     VALUES ($1, $2, TRUE, FALSE)
     RETURNING id`,
    [userId, DECK_NAME]
  );
  const deckId = deck.rows[0].id as number;

  for (const c of main) {
    await query(
      `INSERT INTO deck_cards (deck_id, card_id, quantity, is_extra_deck)
       VALUES ($1, $2, $3, FALSE)
       ON CONFLICT (deck_id, card_id, is_extra_deck) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [deckId, c.cardDbId, c.quantity]
    );
  }
  for (const c of extra) {
    await query(
      `INSERT INTO deck_cards (deck_id, card_id, quantity, is_extra_deck)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (deck_id, card_id, is_extra_deck) DO UPDATE SET quantity = EXCLUDED.quantity`,
      [deckId, c.cardDbId, c.quantity]
    );
  }

  return deckId;
}

async function main(): Promise<void> {
  const deckOnly = process.argv.includes('--deck-only');

  const users = await query('SELECT id, username FROM users ORDER BY id');
  if (!users.rowCount) {
    console.error('Aucun utilisateur en base.');
    process.exit(1);
  }
  console.log(`${users.rowCount} utilisateur(s) : ${users.rows.map((u: any) => u.username).join(', ')}\n`);

  console.log('Résolution des cartes auprès de YGOProDeck (une seule fois pour tous) :');
  const mainCards = await resolveAll(MAIN_SEEDS, 'Main ');
  const extraCards = await resolveAll(EXTRA_SEEDS, 'Extra');

  const deckMain = pickDeckCards(mainCards, DECK_MAIN_SIZE);
  const deckExtra = pickDeckCards(extraCards, DECK_EXTRA_SIZE);

  const mainTotal = deckMain.reduce((a, c) => a + c.quantity, 0);
  const extraTotal = deckExtra.reduce((a, c) => a + c.quantity, 0);

  console.log(`\nDeck « ${DECK_NAME} » : ${mainTotal} cartes principales (${deckMain.length} distinctes), ${extraTotal} en Extra (${deckExtra.length} distinctes)`);
  const illegal = [...deckMain, ...deckExtra].filter((c) => c.quantity > MAX_COPIES);
  console.log(
    `  Règles : 40-60 principal ${mainTotal >= 40 && mainTotal <= 60 ? '✓' : '✗'} · ` +
      `Extra ≤ 15 ${extraTotal <= 15 ? '✓' : '✗'} · ` +
      `≤ 3 par carte ${illegal.length === 0 ? '✓' : `✗ (${illegal.length})`}`
  );

  console.log('');
  for (const user of users.rows as Array<{ id: number; username: string }>) {
    let collected = 0;
    if (!deckOnly) {
      collected += await fillCollection(user.id, mainCards);
      collected += await fillCollection(user.id, extraCards);
    }
    const deckId = await createDeck(user.id, deckMain, deckExtra);
    console.log(
      `  ✓ ${user.username.padEnd(12)} · ${deckOnly ? 'collection inchangée' : `${collected} cartes en collection`} · deck #${deckId}`
    );
  }

  const check = await query(
    `SELECT u.username,
            (SELECT COALESCE(SUM(uc.quantity), 0) FROM user_cards uc WHERE uc.user_id = u.id) AS cartes,
            (SELECT COUNT(*) FROM decks d WHERE d.user_id = u.id) AS decks
       FROM users u ORDER BY u.id`
  );
  console.log('\n=== Vérification ===');
  for (const r of check.rows as any[]) {
    console.log(`  ${String(r.username).padEnd(12)} ${String(r.cartes).padStart(4)} cartes · ${r.decks} deck(s)`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal :', err);
  process.exit(1);
});
