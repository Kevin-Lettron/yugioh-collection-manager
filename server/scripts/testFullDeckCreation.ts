/**
 * Full Integration Test: User Creation, Collection, and Deck Building
 * Tests the complete flow with real API data
 */

import { query } from '../src/config/database';
import { UserModel } from '../src/models/userModel';
import { CardModel } from '../src/models/cardModel';
import { UserCardModel } from '../src/models/userCardModel';
import { DeckModel } from '../src/models/deckModel';
import { YGOProDeckService } from '../src/services/ygoprodeckService';
import { Card } from '../../shared/types';

// Card IDs to fetch
const CARD_IDS_TO_FETCH = [
  // Main Deck - Normal/Effect Monsters
  '89631146', // Blue-Eyes White Dragon
  '64202399', // Blue-Eyes Abyss Dragon
  '38517737', // Blue-Eyes Alternative White Dragon
  '30576089', // Blue-Eyes Jet Dragon
  '57043986', // Blue-Eyes Solid Dragon
  '22804410', // Deep-Eyes White Dragon
  '45467446', // Dragon Spirit of White
  '34627841', // Kaibaman
  '88241506', // Maiden with Eyes of Blue
  '45644898', // Master with Eyes of Blue
  '36734924', // Priestess with Eyes of Blue
  '72855441', // Protector with Eyes of Blue
  '8240199',  // Sage with Eyes of Blue
  '71039903', // The White Stone of Ancients
  '79814787', // The White Stone of Legend
  '55410871', // Blue-Eyes Chaos MAX Dragon

  // Spells
  '50371210', // Beacon of White
  '93437091', // Bingo Machine, Go!!!
  '17655904', // Burst Stream of Destruction
  '21082832', // Chaos Form
  '24382602', // Mausoleum of White
  '71143015', // Ultimate Fusion
  '29432790', // Rage with Eyes of Blue

  // Traps
  '62089826', // True Light
  '56920308', // The Ultimate Creature of Destruction

  // Extra Deck - Fusion
  '43228023', // Blue-Eyes Alternative Ultimate Dragon
  '2129638',  // Blue-Eyes Twin Burst Dragon
  '23995348', // Blue-Eyes Ultimate Dragon
  '56532353', // Neo Blue-Eyes Ultimate Dragon

  // Extra Deck - Synchro
  '59822133', // Blue-Eyes Spirit Dragon
  '89604813', // Blue-Eyes Ultimate Spirit Dragon
  '25862681', // Ancient Fairy Dragon

  // Extra Deck - XYZ
  '21044178', // Abyss Dweller

  // Extra Deck - Link
  '86066372', // Accesscode Talker
];

interface TestResult {
  step: string;
  success: boolean;
  message: string;
}

const results: TestResult[] = [];
let testUserId: number | null = null;
let testDeckId: number | null = null;
const cardCache: Map<string, Card> = new Map();

function logResult(step: string, success: boolean, message: string) {
  const icon = success ? '✓' : '✗';
  console.log(`  ${icon} ${step}: ${message}`);
  results.push({ step, success, message });
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up previous test data...');
  try {
    await query(`DELETE FROM users WHERE email = 'test-deck@example.com'`);
    console.log('  ✓ Previous test data cleaned');
  } catch (error) {
    console.log('  ⚠ No previous test data to clean');
  }
}

async function step1_CreateUser(): Promise<boolean> {
  console.log('\n📝 Step 1: Creating test user...');

  try {
    const user = await UserModel.create(
      'BluEyesDuelist',
      'test-deck@example.com',
      'TestPassword123!'
    );

    if (user && user.id) {
      testUserId = user.id;
      logResult('Create User', true, `User created with ID: ${user.id}`);
      return true;
    } else {
      logResult('Create User', false, 'User creation returned null');
      return false;
    }
  } catch (error: any) {
    logResult('Create User', false, `Error: ${error.message}`);
    return false;
  }
}

async function step2_FetchAndStoreCards(): Promise<boolean> {
  console.log('\n🃏 Step 2: Fetching cards from YGOProDeck API...');

  let successCount = 0;
  let failCount = 0;

  for (const cardId of CARD_IDS_TO_FETCH) {
    try {
      const apiCard = await YGOProDeckService.getCardById(cardId);

      if (apiCard) {
        // Store in database
        const dbCard = await CardModel.upsert({
          card_id: apiCard.card_id,
          name: apiCard.name,
          type: apiCard.type,
          frame_type: apiCard.frame_type,
          description: apiCard.description,
          atk: apiCard.atk,
          def: apiCard.def,
          level: apiCard.level,
          race: apiCard.race,
          attribute: apiCard.attribute,
          archetype: apiCard.archetype,
          card_sets: apiCard.card_sets,
          card_images: apiCard.card_images,
          banlist_info: apiCard.banlist_info,
          linkval: apiCard.linkval,
          linkmarkers: apiCard.linkmarkers,
          scale: apiCard.scale,
        });

        cardCache.set(cardId, dbCard);
        successCount++;
        console.log(`    ✓ ${apiCard.name}`);
      } else {
        failCount++;
        console.log(`    ✗ Card not found: ${cardId}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      failCount++;
      console.log(`    ✗ Error fetching ${cardId}: ${error.message}`);
    }
  }

  logResult('Fetch Cards', successCount >= 30, `Fetched ${successCount}/${CARD_IDS_TO_FETCH.length} cards`);
  return successCount >= 30;
}

async function step3_AddCardsToCollection(): Promise<boolean> {
  console.log('\n📦 Step 3: Adding cards to user collection...');

  if (!testUserId) {
    logResult('Add to Collection', false, 'No user ID');
    return false;
  }

  let successCount = 0;

  for (const [cardId, card] of cardCache) {
    try {
      // Add 3 copies of each card
      await UserCardModel.addToCollection(
        testUserId,
        card.id,
        'TEST-001',
        'Common',
        3
      );
      successCount++;
    } catch (error: any) {
      console.log(`    ✗ Error adding ${card.name}: ${error.message}`);
    }
  }

  logResult('Add to Collection', successCount > 0, `Added ${successCount} cards to collection`);
  return successCount >= 30;
}

async function step4_CreateDeck(): Promise<boolean> {
  console.log('\n🎴 Step 4: Creating Blue-Eyes deck...');

  if (!testUserId) {
    logResult('Create Deck', false, 'No user ID');
    return false;
  }

  try {
    const deck = await DeckModel.create(
      testUserId,
      'Blue-Eyes White Dragon Deck',
      true,  // respectBanlist
      true   // isPublic
    );

    if (deck && deck.id) {
      testDeckId = deck.id;
      logResult('Create Deck', true, `Deck created with ID: ${deck.id}`);
      return true;
    } else {
      logResult('Create Deck', false, 'Deck creation returned null');
      return false;
    }
  } catch (error: any) {
    logResult('Create Deck', false, `Error: ${error.message}`);
    return false;
  }
}

async function step5_AddMainDeckCards(): Promise<boolean> {
  console.log('\n🃏 Step 5: Adding cards to Main Deck (target: 40 cards)...');

  if (!testUserId || !testDeckId) {
    logResult('Add Main Deck', false, 'No user or deck ID');
    return false;
  }

  // Main deck card configuration with quantities (total = 40)
  const mainDeckCards = [
    { id: '89631146', qty: 3 },  // Blue-Eyes White Dragon x3
    { id: '38517737', qty: 3 },  // Blue-Eyes Alternative White Dragon x3
    { id: '88241506', qty: 3 },  // Maiden with Eyes of Blue x3
    { id: '8240199', qty: 3 },   // Sage with Eyes of Blue x3
    { id: '71039903', qty: 2 },  // The White Stone of Ancients x2
    { id: '79814787', qty: 2 },  // The White Stone of Legend x2
    { id: '45467446', qty: 2 },  // Dragon Spirit of White x2
    { id: '64202399', qty: 2 },  // Blue-Eyes Abyss Dragon x2
    { id: '57043986', qty: 2 },  // Blue-Eyes Solid Dragon x2
    { id: '55410871', qty: 1 },  // Blue-Eyes Chaos MAX Dragon x1
    { id: '34627841', qty: 2 },  // Kaibaman x2
    { id: '50371210', qty: 2 },  // Beacon of White x2
    { id: '93437091', qty: 2 },  // Bingo Machine, Go!!! x2
    { id: '21082832', qty: 2 },  // Chaos Form x2
    { id: '24382602', qty: 2 },  // Mausoleum of White x2
    { id: '29432790', qty: 2 },  // Rage with Eyes of Blue x2
    { id: '62089826', qty: 2 },  // True Light x2
    { id: '56920308', qty: 1 },  // The Ultimate Creature of Destruction x1
  ];

  let totalCards = 0;

  for (const { id, qty } of mainDeckCards) {
    const card = cardCache.get(id);
    if (card) {
      try {
        const result = await DeckModel.addCard(
          testDeckId,
          testUserId,
          card.id,
          qty,
          false, // not extra deck
          card
        );

        if (result.success) {
          totalCards += qty;
          console.log(`    ✓ ${card.name} x${qty}`);
        } else {
          console.log(`    ✗ ${card.name}: ${result.error}`);
        }
      } catch (error: any) {
        console.log(`    ✗ Error adding ${card.name}: ${error.message}`);
      }
    } else {
      console.log(`    ⚠ Card ${id} not in cache`);
    }
  }

  logResult('Add Main Deck', totalCards >= 40, `Added ${totalCards} cards to Main Deck`);
  return totalCards >= 40;
}

async function step6_AddExtraDeckCards(): Promise<boolean> {
  console.log('\n✨ Step 6: Adding cards to Extra Deck (target: 15 cards)...');

  if (!testUserId || !testDeckId) {
    logResult('Add Extra Deck', false, 'No user or deck ID');
    return false;
  }

  // Extra deck card configuration with quantities (total = 15)
  const extraDeckCards = [
    { id: '43228023', qty: 1 },  // Blue-Eyes Alternative Ultimate Dragon x1
    { id: '2129638', qty: 2 },   // Blue-Eyes Twin Burst Dragon x2
    { id: '23995348', qty: 3 },  // Blue-Eyes Ultimate Dragon x3
    { id: '56532353', qty: 2 },  // Neo Blue-Eyes Ultimate Dragon x2
    { id: '59822133', qty: 2 },  // Blue-Eyes Spirit Dragon x2
    { id: '89604813', qty: 1 },  // Blue-Eyes Ultimate Spirit Dragon x1
    { id: '25862681', qty: 1 },  // Ancient Fairy Dragon x1
    { id: '21044178', qty: 1 },  // Abyss Dweller x1
    { id: '86066372', qty: 2 },  // Accesscode Talker x2
  ];

  let totalCards = 0;

  for (const { id, qty } of extraDeckCards) {
    const card = cardCache.get(id);
    if (card) {
      try {
        const result = await DeckModel.addCard(
          testDeckId,
          testUserId,
          card.id,
          qty,
          true, // is extra deck
          card
        );

        if (result.success) {
          totalCards += qty;
          console.log(`    ✓ ${card.name} x${qty}`);
        } else {
          console.log(`    ✗ ${card.name}: ${result.error}`);
        }
      } catch (error: any) {
        console.log(`    ✗ Error adding ${card.name}: ${error.message}`);
      }
    } else {
      console.log(`    ⚠ Card ${id} not in cache`);
    }
  }

  logResult('Add Extra Deck', totalCards <= 15, `Added ${totalCards} cards to Extra Deck`);
  return totalCards <= 15 && totalCards > 0;
}

async function step7_ValidateDeck(): Promise<boolean> {
  console.log('\n✅ Step 7: Validating deck...');

  if (!testDeckId) {
    logResult('Validate Deck', false, 'No deck ID');
    return false;
  }

  try {
    const validation = await DeckModel.validateDeck(testDeckId);

    console.log(`    📊 Main Deck: ${validation.mainDeckCount} cards`);
    console.log(`    📊 Extra Deck: ${validation.extraDeckCount} cards`);
    console.log(`    📊 Valid: ${validation.valid}`);

    if (validation.errors.length > 0) {
      console.log(`    ⚠ Errors:`);
      validation.errors.forEach(e => console.log(`      - ${e}`));
    }

    const validMainDeck = validation.mainDeckCount >= 40 && validation.mainDeckCount <= 60;
    const validExtraDeck = validation.extraDeckCount <= 15;

    console.log(`    ${validMainDeck ? '✓' : '✗'} Main Deck size valid (40-60)`);
    console.log(`    ${validExtraDeck ? '✓' : '✗'} Extra Deck size valid (max 15)`);

    logResult('Validate Deck', validation.valid, `Deck is ${validation.valid ? 'VALID' : 'INVALID'}`);
    return validation.valid;
  } catch (error: any) {
    logResult('Validate Deck', false, `Error: ${error.message}`);
    return false;
  }
}

async function step8_DisplayDeckSummary(): Promise<void> {
  console.log('\n📋 Step 8: Deck Summary...');

  if (!testUserId || !testDeckId) {
    console.log('  No deck to display');
    return;
  }

  try {
    const deck = await DeckModel.findById(testDeckId, testUserId);

    if (!deck) {
      console.log('  Deck not found');
      return;
    }

    console.log(`\n  ═══════════════════════════════════════════════════════`);
    console.log(`  📛 ${deck.name}`);
    console.log(`  ═══════════════════════════════════════════════════════`);

    const mainDeckCount = deck.main_deck?.reduce((s, c) => s + (c.quantity || 1), 0) || 0;
    const extraDeckCount = deck.extra_deck?.reduce((s, c) => s + (c.quantity || 1), 0) || 0;

    console.log(`\n  🃏 MAIN DECK (${mainDeckCount} cards):`);
    console.log(`  ───────────────────────────────────────────────────────`);

    const monsters = deck.main_deck?.filter(c => c.card?.type?.includes('Monster')) || [];
    const spells = deck.main_deck?.filter(c => c.card?.type?.includes('Spell')) || [];
    const traps = deck.main_deck?.filter(c => c.card?.type?.includes('Trap')) || [];

    if (monsters.length > 0) {
      console.log(`\n    🐉 Monsters (${monsters.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      monsters.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    if (spells.length > 0) {
      console.log(`\n    ✨ Spells (${spells.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      spells.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    if (traps.length > 0) {
      console.log(`\n    🛡️ Traps (${traps.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      traps.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    console.log(`\n  ✨ EXTRA DECK (${extraDeckCount} cards):`);
    console.log(`  ───────────────────────────────────────────────────────`);

    const fusions = deck.extra_deck?.filter(c => c.card?.frame_type === 'fusion') || [];
    const synchros = deck.extra_deck?.filter(c => c.card?.frame_type === 'synchro') || [];
    const xyzs = deck.extra_deck?.filter(c => c.card?.frame_type === 'xyz') || [];
    const links = deck.extra_deck?.filter(c => c.card?.frame_type === 'link') || [];

    if (fusions.length > 0) {
      console.log(`\n    🔮 Fusion (${fusions.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      fusions.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    if (synchros.length > 0) {
      console.log(`\n    ⚡ Synchro (${synchros.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      synchros.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    if (xyzs.length > 0) {
      console.log(`\n    🌟 XYZ (${xyzs.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      xyzs.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    if (links.length > 0) {
      console.log(`\n    🔗 Link (${links.reduce((s, c) => s + (c.quantity || 1), 0)}):`);
      links.forEach(c => console.log(`      - ${c.card?.name} x${c.quantity || 1}`));
    }

    console.log(`\n  ═══════════════════════════════════════════════════════\n`);
  } catch (error: any) {
    console.log(`  Error: ${error.message}`);
  }
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   YuGiOh Collection Manager - Full Integration Test     ║');
  console.log('║   Testing: User, Collection, and Deck Creation          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    await cleanupTestData();

    const step1 = await step1_CreateUser();
    if (!step1) throw new Error('Step 1 failed');

    const step2 = await step2_FetchAndStoreCards();
    if (!step2) throw new Error('Step 2 failed');

    const step3 = await step3_AddCardsToCollection();
    if (!step3) throw new Error('Step 3 failed');

    const step4 = await step4_CreateDeck();
    if (!step4) throw new Error('Step 4 failed');

    await step5_AddMainDeckCards();
    await step6_AddExtraDeckCards();
    await step7_ValidateDeck();
    await step8_DisplayDeckSummary();

  } catch (error: any) {
    console.log(`\n❌ Test stopped: ${error.message}`);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const icon = r.success ? '✓' : '✗';
    console.log(`  ${icon} ${r.step}: ${r.message}`);
  });

  console.log(`\n  ⏱️ Duration: ${duration}s`);
  console.log(`  📊 Results: ${passed} passed, ${failed} failed`);
  console.log(`  ${failed === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`);

  process.exit(failed === 0 ? 0 : 1);
}

runTests();
