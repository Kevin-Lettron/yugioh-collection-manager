/**
 * Test script for Mausoleum of White card
 * Runs a real API call to verify the card data
 */

import { YGOProDeckService } from '../src/services/ygoprodeckService';

const CARD_ID = '24382602';
const CARD_NAME = 'Mausoleum of White';

async function testMausoleumWhite() {
  console.log('='.repeat(60));
  console.log('Testing Mausoleum of White Card Integration');
  console.log('='.repeat(60));
  console.log('');

  let allTestsPassed = true;

  // Test 1: Fetch by ID
  console.log('Test 1: Fetching by Card ID (24382602)...');
  try {
    const cardById = await YGOProDeckService.getCardById(CARD_ID);

    if (cardById) {
      console.log('  ✓ Card found by ID');
      console.log(`    - Name: ${cardById.name}`);
      console.log(`    - Card ID: ${cardById.card_id}`);
      console.log(`    - Type: ${cardById.type}`);
      console.log(`    - Frame Type: ${cardById.frame_type}`);
      console.log(`    - Race: ${cardById.race}`);
      console.log(`    - Image URL: ${cardById.card_images?.[0]?.image_url || 'N/A'}`);

      // Verify card data
      if (cardById.name !== CARD_NAME) {
        console.log(`  ✗ Name mismatch: expected "${CARD_NAME}", got "${cardById.name}"`);
        allTestsPassed = false;
      } else {
        console.log('  ✓ Name matches');
      }

      if (cardById.type !== 'Spell Card') {
        console.log(`  ✗ Type mismatch: expected "Spell Card", got "${cardById.type}"`);
        allTestsPassed = false;
      } else {
        console.log('  ✓ Type is "Spell Card"');
      }

      if (cardById.frame_type !== 'spell') {
        console.log(`  ✗ Frame type mismatch: expected "spell", got "${cardById.frame_type}"`);
        allTestsPassed = false;
      } else {
        console.log('  ✓ Frame type is "spell"');
      }

      if (cardById.race !== 'Field') {
        console.log(`  ✗ Race mismatch: expected "Field", got "${cardById.race}"`);
        allTestsPassed = false;
      } else {
        console.log('  ✓ Race is "Field" (Field Spell)');
      }

      // Check card sets
      if (cardById.card_sets && cardById.card_sets.length > 0) {
        console.log(`  ✓ Has ${cardById.card_sets.length} card sets:`);
        cardById.card_sets.forEach((set: any) => {
          console.log(`    - ${set.set_code}: ${set.set_name} (${set.set_rarity})`);
        });

        // Check for specific sets
        const hasSHVI = cardById.card_sets.some((s: any) => s.set_code === 'SHVI-EN059');
        const hasLED3 = cardById.card_sets.some((s: any) => s.set_code === 'LED3-EN012');

        if (hasSHVI) {
          console.log('  ✓ Contains SHVI-EN059 (Shining Victories)');
        } else {
          console.log('  ✗ Missing SHVI-EN059');
          allTestsPassed = false;
        }

        // LED3-EN012 was replaced by LDS2-EN023 in Legendary Duelists: Season 2
        const hasLDS2 = cardById.card_sets.some((s: any) => s.set_code === 'LDS2-EN023');
        if (hasLDS2 || hasLED3) {
          console.log('  ✓ Contains Legendary Duelists set (LDS2-EN023 or LED3-EN012)');
        } else {
          console.log('  ✗ Missing Legendary Duelists set');
          allTestsPassed = false;
        }
      } else {
        console.log('  ✗ No card sets found');
        allTestsPassed = false;
      }

      // Check description
      if (cardById.description && cardById.description.includes('Burst Stream of Destruction')) {
        console.log('  ✓ Description mentions "Burst Stream of Destruction"');
      } else {
        console.log('  ✗ Description missing "Burst Stream of Destruction"');
        allTestsPassed = false;
      }

    } else {
      console.log('  ✗ Card NOT found by ID');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    allTestsPassed = false;
  }

  console.log('');

  // Test 2: Fetch by Name
  console.log('Test 2: Fetching by Name ("Mausoleum of White")...');
  try {
    const cardByName = await YGOProDeckService.getCardByName(CARD_NAME);

    if (cardByName) {
      console.log('  ✓ Card found by name');
      console.log(`    - Name: ${cardByName.name}`);
      console.log(`    - Card ID: ${cardByName.card_id}`);

      if (cardByName.card_id === CARD_ID) {
        console.log('  ✓ Card ID matches (24382602)');
      } else {
        console.log(`  ✗ Card ID mismatch: expected "${CARD_ID}", got "${cardByName.card_id}"`);
        allTestsPassed = false;
      }
    } else {
      console.log('  ✗ Card NOT found by name');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    allTestsPassed = false;
  }

  console.log('');

  // Test 3: Search for "Mausoleum"
  console.log('Test 3: Searching for "Mausoleum"...');
  try {
    const searchResults = await YGOProDeckService.searchCards('Mausoleum', 10);

    if (searchResults.length > 0) {
      console.log(`  ✓ Found ${searchResults.length} cards matching "Mausoleum"`);

      const mausoleumWhite = searchResults.find(c => c.name === CARD_NAME);
      if (mausoleumWhite) {
        console.log('  ✓ "Mausoleum of White" found in search results');
      } else {
        console.log('  ✗ "Mausoleum of White" NOT in search results');
        allTestsPassed = false;
      }

      console.log('    Search results:');
      searchResults.forEach((card, i) => {
        console.log(`    ${i + 1}. ${card.name} (${card.type})`);
      });
    } else {
      console.log('  ✗ No cards found for "Mausoleum"');
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`  ✗ Error: ${error}`);
    allTestsPassed = false;
  }

  console.log('');
  console.log('='.repeat(60));

  if (allTestsPassed) {
    console.log('✓ ALL TESTS PASSED');
  } else {
    console.log('✗ SOME TESTS FAILED');
  }

  console.log('='.repeat(60));

  process.exit(allTestsPassed ? 0 : 1);
}

testMausoleumWhite();
