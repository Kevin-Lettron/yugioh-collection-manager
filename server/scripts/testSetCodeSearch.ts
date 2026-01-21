/**
 * Test script for Set Code search functionality
 * Tests searching for cards by Set Code (e.g., LDK2-FRK40)
 */

import { YGOProDeckService } from '../src/services/ygoprodeckService';

// Test cases with various Set Codes
const TEST_CASES = [
  { setCode: 'LDK2-FRK40', expectedName: 'Blue-Eyes Ultimate Dragon' },
  { setCode: 'SHVI-EN059', expectedName: 'Mausoleum of White' },
  { setCode: 'LOB-001', expectedName: 'Blue-Eyes White Dragon' },
  { setCode: 'SDK-001', expectedName: 'Blue-Eyes White Dragon' },
];

async function testSetCodeSearch() {
  console.log('='.repeat(60));
  console.log('Testing Set Code Search Functionality');
  console.log('='.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\nTest: Searching for "${testCase.setCode}"...`);

    try {
      const result = await YGOProDeckService.searchByCodeOrSetCode(testCase.setCode);

      if (result.card) {
        console.log(`  Found: ${result.card.name}`);

        if (result.card.name === testCase.expectedName) {
          console.log(`  [PASS] Name matches expected: "${testCase.expectedName}"`);
          passed++;
        } else {
          console.log(`  [FAIL] Expected: "${testCase.expectedName}", Got: "${result.card.name}"`);
          failed++;
        }

        if (result.setInfo) {
          console.log(`  Set Info: ${result.setInfo.set_code} - ${result.setInfo.set_name} (${result.setInfo.set_rarity})`);
        }

        // Show available sets
        if (result.card.card_sets && result.card.card_sets.length > 0) {
          console.log(`  Available sets: ${result.card.card_sets.length}`);
          result.card.card_sets.slice(0, 5).forEach((set: any) => {
            console.log(`    - ${set.set_code}: ${set.set_name} (${set.set_rarity})`);
          });
          if (result.card.card_sets.length > 5) {
            console.log(`    ... and ${result.card.card_sets.length - 5} more`);
          }
        }
      } else {
        console.log(`  [FAIL] Card not found for set code: ${testCase.setCode}`);
        failed++;
      }
    } catch (error) {
      console.log(`  [ERROR] ${error}`);
      failed++;
    }
  }

  // Test Card ID search
  console.log('\n' + '-'.repeat(60));
  console.log('Testing Card ID Search...');
  console.log('-'.repeat(60));

  const cardIdTestCases = [
    { cardId: '89631139', expectedName: 'Blue-Eyes White Dragon' },
    { cardId: '24382602', expectedName: 'Mausoleum of White' },
  ];

  for (const testCase of cardIdTestCases) {
    console.log(`\nTest: Searching for Card ID "${testCase.cardId}"...`);

    try {
      const result = await YGOProDeckService.searchByCodeOrSetCode(testCase.cardId);

      if (result.card) {
        console.log(`  Found: ${result.card.name}`);

        if (result.card.name === testCase.expectedName) {
          console.log(`  [PASS] Name matches expected: "${testCase.expectedName}"`);
          passed++;
        } else {
          console.log(`  [FAIL] Expected: "${testCase.expectedName}", Got: "${result.card.name}"`);
          failed++;
        }
      } else {
        console.log(`  [FAIL] Card not found for ID: ${testCase.cardId}`);
        failed++;
      }
    } catch (error) {
      console.log(`  [ERROR] ${error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

testSetCodeSearch();
