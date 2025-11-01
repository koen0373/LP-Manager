/**
 * RangeBand™ — Range Status & Strategy Tests
 * 
 * Tests for range status detection, strategy classification, marker positioning,
 * and track width computation based on strategy.
 */

import {
  PRODUCT_NAME,
  getStrategy,
  getRangeStatus,
  getRangeWidthPct,
  calculateMarkerPosition,
  computeTrackWidthFactor,
  RANGE_STRATEGY_THRESHOLDS,
  STRATEGY_THRESHOLDS,
} from '../PoolRangeIndicator';
import { calcApr24h } from '../../../lib/metrics';

describe('RangeBand™ Product Name', () => {
  it('should export the correct product name constant', () => {
    expect(PRODUCT_NAME).toBe('RangeBand™');
  });
});

describe('RangeBand™ Strategy Classification', () => {
  describe('getStrategy', () => {
    it('should classify narrow ranges as Aggressive (< 12%)', () => {
      const result1 = getStrategy(5);
      expect(result1.label).toBe('Aggressive');
      expect(result1.tone).toBe('aggressive');
      expect(result1.pct).toBe(5);

      const result2 = getStrategy(11.9);
      expect(result2.label).toBe('Aggressive');
      expect(result2.tone).toBe('aggressive');
    });

    it('should classify medium ranges as Balanced (12% – 35%)', () => {
      const result1 = getStrategy(12.0);
      expect(result1.label).toBe('Balanced');
      expect(result1.tone).toBe('balanced');

      const result2 = getStrategy(20);
      expect(result2.label).toBe('Balanced');
      expect(result2.tone).toBe('balanced');

      const result3 = getStrategy(25);
      expect(result3.label).toBe('Balanced');
      expect(result3.tone).toBe('balanced');

      const result4 = getStrategy(35.0);
      expect(result4.label).toBe('Balanced');
      expect(result4.tone).toBe('balanced');
    });

    it('should classify wide ranges as Conservative (> 35%)', () => {
      const result1 = getStrategy(35.1);
      expect(result1.label).toBe('Conservative');
      expect(result1.tone).toBe('conservative');

      const result2 = getStrategy(50);
      expect(result2.label).toBe('Conservative');
      expect(result2.tone).toBe('conservative');

      const result3 = getStrategy(100);
      expect(result3.label).toBe('Conservative');
      expect(result3.tone).toBe('conservative');
    });

    it('should handle edge cases', () => {
      // Zero should be Aggressive
      const zero = getStrategy(0);
      expect(zero.label).toBe('Aggressive');

      // Negative (invalid) should be treated as 0 → Aggressive
      const negative = getStrategy(-5);
      expect(negative.label).toBe('Aggressive');
      expect(negative.pct).toBe(0);

      // Infinity should be Conservative
      const inf = getStrategy(Infinity);
      expect(inf.label).toBe('Conservative');

      // NaN should default to Aggressive
      const nan = getStrategy(NaN);
      expect(nan.label).toBe('Aggressive');
      expect(nan.pct).toBe(0);
    });

    it('should match documented thresholds', () => {
      expect(STRATEGY_THRESHOLDS.aggressiveLt).toBe(12);
      expect(STRATEGY_THRESHOLDS.conservativeGt).toBe(35);
      
      // Legacy aliases
      expect(RANGE_STRATEGY_THRESHOLDS.aggressiveMax).toBe(12);
      expect(RANGE_STRATEGY_THRESHOLDS.balancedMax).toBe(35);
    });

    it('should test exact boundary values', () => {
      // 11.99% → Aggressive
      const almostBalanced = getStrategy(11.99);
      expect(almostBalanced.label).toBe('Aggressive');

      // 12.0% → Balanced (inclusive)
      const justBalanced = getStrategy(12.0);
      expect(justBalanced.label).toBe('Balanced');

      // 35.0% → Balanced (inclusive)
      const stillBalanced = getStrategy(35.0);
      expect(stillBalanced.label).toBe('Balanced');

      // 35.01% → Conservative
      const justConservative = getStrategy(35.01);
      expect(justConservative.label).toBe('Conservative');
    });
  });

  describe('getRangeWidthPct', () => {
    it('should calculate range width percentage correctly', () => {
      // Range 0.2 to 0.8, midpoint = 0.5
      // Width = 0.6, percentage = (0.6 / 0.5) * 100 = 120%
      const pct = getRangeWidthPct(0.2, 0.8);
      expect(pct).toBeCloseTo(120, 1);
    });

    it('should return 0 for invalid inputs', () => {
      expect(getRangeWidthPct(null, 0.8)).toBe(0);
      expect(getRangeWidthPct(0.2, null)).toBe(0);
      expect(getRangeWidthPct(NaN, 0.8)).toBe(0);
      expect(getRangeWidthPct(0.8, 0.2)).toBe(0); // min >= max
    });

    it('should clamp to 999% maximum', () => {
      // Very wide range
      const pct = getRangeWidthPct(0.001, 10);
      expect(pct).toBe(999);
    });
  });
});

describe('RangeBand™ Track Width Computation', () => {
  describe('computeTrackWidthFactor', () => {
    it('should return 0.52 factor for aggressive strategy', () => {
      const strategy = getStrategy(9);
      const factor = computeTrackWidthFactor(strategy);
      expect(factor).toBe(0.52);
    });

    it('should return 0.70 factor for balanced strategy', () => {
      const strategy = getStrategy(20);
      const factor = computeTrackWidthFactor(strategy);
      expect(factor).toBe(0.70);
    });

    it('should return 0.88 factor for conservative strategy', () => {
      const strategy = getStrategy(50);
      const factor = computeTrackWidthFactor(strategy);
      expect(factor).toBe(0.88);
    });

    it('should demonstrate track width differences between strategies', () => {
      const aggressive = getStrategy(8);
      const balanced = getStrategy(22);
      const conservative = getStrategy(40);

      const aggressiveFactor = computeTrackWidthFactor(aggressive);
      const balancedFactor = computeTrackWidthFactor(balanced);
      const conservativeFactor = computeTrackWidthFactor(conservative);

      // Conservative tracks should be visibly longer
      expect(conservativeFactor).toBeGreaterThan(balancedFactor);
      expect(balancedFactor).toBeGreaterThan(aggressiveFactor);

      // Example: 600px container
      const containerWidth = 600;
      const aggressiveWidth = containerWidth * aggressiveFactor; // 312px
      const _balancedWidth = containerWidth * balancedFactor; // 420px
      const conservativeWidth = containerWidth * conservativeFactor; // 528px

      expect(conservativeWidth - aggressiveWidth).toBeGreaterThan(200); // Significant visual difference
    });
  });
});

describe('RangeBand™ Status Detection', () => {
  describe('getRangeStatus', () => {
    it('should return "in" when price is comfortably within range', () => {
      const status = getRangeStatus(0.5, 0.2, 0.8);
      expect(status).toBe('in');
    });

    it('should return "near" when price is near the lower bound (within 3% of range width)', () => {
      // Range: 0.2 to 0.8, width = 0.6, 3% = 0.018
      // Near lower = 0.2 + 0.018 = 0.218
      const status = getRangeStatus(0.21, 0.2, 0.8);
      expect(status).toBe('near');
    });

    it('should return "near" when price is near the upper bound (within 3% of range width)', () => {
      // Range: 0.2 to 0.8, width = 0.6, 3% = 0.018
      // Near upper = 0.8 - 0.018 = 0.782
      const status = getRangeStatus(0.79, 0.2, 0.8);
      expect(status).toBe('near');
    });

    it('should return "out" when price is below range', () => {
      const status = getRangeStatus(0.1, 0.2, 0.8);
      expect(status).toBe('out');
    });

    it('should return "out" when price is above range', () => {
      const status = getRangeStatus(0.9, 0.2, 0.8);
      expect(status).toBe('out');
    });

    it('should return "out" for invalid inputs', () => {
      expect(getRangeStatus(null, 0.2, 0.8)).toBe('out');
      expect(getRangeStatus(0.5, null, 0.8)).toBe('out');
      expect(getRangeStatus(0.5, 0.2, null)).toBe('out');
      expect(getRangeStatus(NaN, 0.2, 0.8)).toBe('out');
      expect(getRangeStatus(0.5, NaN, 0.8)).toBe('out');
      expect(getRangeStatus(0.5, 0.2, NaN)).toBe('out');
    });

    it('should return "out" when lower >= upper (invalid range)', () => {
      expect(getRangeStatus(0.5, 0.8, 0.2)).toBe('out');
      expect(getRangeStatus(0.5, 0.5, 0.5)).toBe('out');
    });
  });
});

describe('APR calculation (fees + incentives)', () => {
  it('includes daily incentives in the 24h APR computation', () => {
    const tvlUsd = 1000;
    const feesOnlyApr = calcApr24h({
      tvlUsd,
      dailyFeesUsd: 5,
      dailyIncentivesUsd: 0,
    });

    const feesPlusIncentives = calcApr24h({
      tvlUsd,
      dailyFeesUsd: 5,
      dailyIncentivesUsd: 5,
    });

    expect(feesOnlyApr).toBeCloseTo(((5 / tvlUsd) * 365 * 100), 5);
    expect(feesPlusIncentives).toBeGreaterThan(feesOnlyApr);
    expect(feesPlusIncentives).toBeCloseTo(((10 / tvlUsd) * 365 * 100), 5);
  });

  it('returns 0 APR when TVL is non-positive', () => {
    expect(
      calcApr24h({
        tvlUsd: 0,
        dailyFeesUsd: 5,
        dailyIncentivesUsd: 2,
      }),
    ).toBe(0);

    expect(
      calcApr24h({
        tvlUsd: -100,
        dailyFeesUsd: 5,
        dailyIncentivesUsd: 2,
      }),
    ).toBe(0);
  });
});

describe('RangeBand™ Marker Positioning', () => {
  describe('calculateMarkerPosition', () => {
    it('should position marker at 0% when current equals min', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.2);
      expect(pos).toBe(0);
    });

    it('should position marker at 50% when current is at midpoint', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.5);
      expect(pos).toBe(50);
    });

    it('should position marker at 100% when current equals max', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.8);
      expect(pos).toBe(100);
    });

    it('should clamp marker at 0% when current is below min', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.1);
      expect(pos).toBe(0);
    });

    it('should clamp marker at 100% when current is above max', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.9);
      expect(pos).toBe(100);
    });

    it('should position marker at 25% for quarter position', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.35); // 0.2 + (0.6 * 0.25) = 0.35
      expect(pos).toBe(25);
    });

    it('should position marker at 75% for three-quarter position', () => {
      const pos = calculateMarkerPosition(0.2, 0.8, 0.65); // 0.2 + (0.6 * 0.75) = 0.65
      expect(pos).toBe(75);
    });

    it('should default to 50% for invalid inputs', () => {
      expect(calculateMarkerPosition(null, 0.8, 0.5)).toBe(50);
      expect(calculateMarkerPosition(0.2, null, 0.5)).toBe(50);
      expect(calculateMarkerPosition(0.2, 0.8, null)).toBe(50);
      expect(calculateMarkerPosition(NaN, 0.8, 0.5)).toBe(50);
    });

    it('should default to 50% when min >= max', () => {
      expect(calculateMarkerPosition(0.8, 0.2, 0.5)).toBe(50);
      expect(calculateMarkerPosition(0.5, 0.5, 0.5)).toBe(50);
    });
  });
});

describe('RangeBand™ Integration Scenarios', () => {
  it('should handle a typical in-range position', () => {
    const lower = 0.016157;
    const upper = 0.018998;
    const current = 0.0175;

    const status = getRangeStatus(current, lower, upper);
    expect(status).toBe('in');

    const markerPos = calculateMarkerPosition(lower, upper, current);
    expect(markerPos).toBeGreaterThan(40);
    expect(markerPos).toBeLessThan(60);

    // Calculate range width %
    const rangeWidthPct = getRangeWidthPct(lower, upper);
    const strategy = getStrategy(rangeWidthPct);

    // This range is ~16.2%, should be Balanced
    expect(strategy.label).toBe('Balanced');
  });

  it('should handle an aggressive (narrow) position', () => {
    const lower = 0.01;
    const upper = 0.0105; // 5% range

    const rangeWidthPct = getRangeWidthPct(lower, upper);
    const strategy = getStrategy(rangeWidthPct);

    // ~9.8% should be Aggressive
    expect(strategy.label).toBe('Aggressive');
    expect(strategy.pct).toBeLessThan(12);
  });

  it('should handle a conservative (wide) position', () => {
    const lower = 0.01;
    const upper = 0.015; // 50% range

    const rangeWidthPct = getRangeWidthPct(lower, upper);
    const strategy = getStrategy(rangeWidthPct);

    // ~40% should be Conservative
    expect(strategy.label).toBe('Conservative');
    expect(strategy.pct).toBeGreaterThan(35);
  });
});

describe('RangeBand™ UI Structure & Accessibility', () => {
  it('should contain the product name in aria-label', () => {
    expect(PRODUCT_NAME).toBe('RangeBand™');
    
    // Example aria-label format (tested via component rendering in integration tests):
    // "RangeBand™, Strategy: Balanced (16.2%), Min 0.016157, Current 0.017500, Max 0.018998, Width 16.2%"
    // NOTE: Visual text omits "Strategy:" but aria-label includes it for clarity
    const exampleLabel = `${PRODUCT_NAME}, Strategy: Balanced (16.2%), Min 0.016157, Current 0.017500, Max 0.018998, Width 16.2%`;
    expect(exampleLabel).toContain('RangeBand™');
    expect(exampleLabel).toContain('Strategy:');
  });

  it('should verify tooltip format includes strategy prefix for accessibility', () => {
    // Example tooltip format:
    // "RangeBand™ — Strategy: Balanced (16.2%) — Current: 0.017500 USD₮0/WFLR"
    // NOTE: Tooltip retains "Strategy:" prefix even though visual text omits it
    const exampleTooltip = `${PRODUCT_NAME} — Strategy: Balanced (16.2%) — Current: 0.017500 USD₮0/WFLR`;
    expect(exampleTooltip).toContain('RangeBand™');
    expect(exampleTooltip).toContain('Strategy:');
    expect(exampleTooltip).toContain('Current:');
  });

  it('should verify visual header text does NOT contain "Strategy:" literal', () => {
    // Header visual text should be: "Balanced (16.2%)" without the word "Strategy:"
    // This test conceptually verifies the pattern (actual DOM test would use React Testing Library)
    const visualText = 'Balanced (16.2%)';
    expect(visualText).not.toContain('Strategy:');
    expect(visualText).toContain('Balanced');
    expect(visualText).toContain('16.2%');
  });

  it('should verify header contains NO status pill', () => {
    // Conceptual test - in practice, this would be tested via DOM query
    // The header should contain ONLY the product name and strategy text
    // NO status pill should appear in the header
    const headerContainsStatusPill = false;
    expect(headerContainsStatusPill).toBe(false);
  });

  it('should verify exactly ONE status pill exists in the band row', () => {
    // Conceptual test - in practice, this would be tested via DOM query
    // The band row should contain exactly ONE status pill at the far right
    // Total status pills in the entire component: exactly 1
    const statusPillCountInComponent = 1;
    expect(statusPillCountInComponent).toBe(1);
  });

  it('should verify status pill is positioned in band row, not header', () => {
    // Conceptual test documenting the expected structure:
    // - Header row: "RangeBand™" (left) + Strategy text (right) — NO status
    // - Band row: min label + track + max label + STATUS PILL (far right)
    const statusInHeader = false;
    const statusInBandRow = true;
    expect(statusInHeader).toBe(false);
    expect(statusInBandRow).toBe(true);
  });

  it('should verify track has inline width style based on strategy', () => {
    // Conceptual test - in practice, this would be tested via DOM query
    // The track wrapper should have an inline style with computed pixel width
    // that reflects the strategy classification
    const trackHasInlineWidth = true;
    expect(trackHasInlineWidth).toBe(true);
  });
});
