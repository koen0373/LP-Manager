/**
 * TEST CASES FOR RANGE STATUS LOGIC
 * 
 * Testing the 3% near-band buffer implementation
 */

// Mock PositionRow data for testing
interface TestCase {
  name: string;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  expectedStatus: 'IN_RANGE' | 'NEAR_BAND' | 'OUT_OF_RANGE';
  description: string;
}

const TEST_CASES: TestCase[] = [
  // Case 1: Out of Range (below minimum)
  {
    name: 'Out of Range - Below Min',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.015,
    expectedStatus: 'OUT_OF_RANGE',
    description: 'Current price (0.015) < min (0.016) → Out of Range (red)',
  },

  // Case 2: Out of Range (above maximum)
  {
    name: 'Out of Range - Above Max',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.020,
    expectedStatus: 'OUT_OF_RANGE',
    description: 'Current price (0.020) > max (0.019) → Out of Range (red)',
  },

  // Case 3: Near Band (lower edge)
  {
    name: 'Near Band - Lower Edge',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.01609, // Just inside lower edge (within 3% buffer)
    expectedStatus: 'NEAR_BAND',
    description: 'Current price within 3% of lower bound → Near Band (orange)',
  },

  // Case 4: Near Band (upper edge)
  {
    name: 'Near Band - Upper Edge',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.01891, // Just inside upper edge (within 3% buffer)
    expectedStatus: 'NEAR_BAND',
    description: 'Current price within 3% of upper bound → Near Band (orange)',
  },

  // Case 5: In Range (safe middle)
  {
    name: 'In Range - Safe Middle',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.0175, // Center of range
    expectedStatus: 'IN_RANGE',
    description: 'Current price in middle of range → In Range (green), earns fees',
  },

  // Case 6: In Range (just past near-band lower)
  {
    name: 'In Range - Just Past Lower Buffer',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.01610, // Just past 3% lower buffer
    expectedStatus: 'IN_RANGE',
    description: 'Current price just past 3% lower buffer → In Range (green)',
  },

  // Case 7: In Range (just past near-band upper)
  {
    name: 'In Range - Just Past Upper Buffer',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.01890, // Just before 3% upper buffer
    expectedStatus: 'IN_RANGE',
    description: 'Current price just before 3% upper buffer → In Range (green)',
  },

  // Case 8: Edge case - Exactly at minimum
  {
    name: 'Edge - Exactly at Min',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.016,
    expectedStatus: 'NEAR_BAND',
    description: 'Current price exactly at min → Near Band (orange)',
  },

  // Case 9: Edge case - Exactly at maximum
  {
    name: 'Edge - Exactly at Max',
    minPrice: 0.016,
    maxPrice: 0.019,
    currentPrice: 0.019,
    expectedStatus: 'NEAR_BAND',
    description: 'Current price exactly at max → Near Band (orange)',
  },
];

/**
 * Calculate expected status based on 3% buffer logic
 */
function calculateExpectedStatus(
  currentPrice: number,
  minPrice: number,
  maxPrice: number
): 'IN_RANGE' | 'NEAR_BAND' | 'OUT_OF_RANGE' {
  // Out of range: current price outside [min, max]
  if (currentPrice < minPrice || currentPrice > maxPrice) {
    return 'OUT_OF_RANGE';
  }

  // Calculate 3% near-band buffer (inside the range edges)
  const width = maxPrice - minPrice;
  const nearBuffer = width * 0.03;
  const nearLower = minPrice + nearBuffer; // 3% inside lower edge
  const nearUpper = maxPrice - nearBuffer; // 3% inside upper edge

  // Near band: within 3% of either edge (but still inside range)
  if (currentPrice <= nearLower || currentPrice >= nearUpper) {
    return 'NEAR_BAND';
  }

  // In range: safely inside range, earning fees
  return 'IN_RANGE';
}

/**
 * Run all test cases
 */
export function runRangeStatusTests(): { passed: number; failed: number; total: number } {
  let passed = 0;
  let failed = 0;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  🧪 RANGE STATUS LOGIC - TEST SUITE');
  console.log('═══════════════════════════════════════════════════════\n');

  TEST_CASES.forEach((testCase, index) => {
    const calculatedStatus = calculateExpectedStatus(
      testCase.currentPrice,
      testCase.minPrice,
      testCase.maxPrice
    );

    const isMatch = calculatedStatus === testCase.expectedStatus;

    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Range: [${testCase.minPrice}, ${testCase.maxPrice}]`);
    console.log(`  Current: ${testCase.currentPrice}`);
    console.log(`  Expected: ${testCase.expectedStatus}`);
    console.log(`  Calculated: ${calculatedStatus}`);
    console.log(`  Result: ${isMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  ${testCase.description}\n`);

    if (isMatch) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  📊 RESULTS: ${passed}/${TEST_CASES.length} PASSED`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} TEST(S) FAILED`);
  } else {
    console.log('  🎉 ALL TESTS PASSED!');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  return { passed, failed, total: TEST_CASES.length };
}

// Export test cases for reference
export { TEST_CASES, calculateExpectedStatus };

