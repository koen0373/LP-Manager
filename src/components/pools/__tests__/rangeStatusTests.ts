/**
 * RangeBand™ — Range Status & Strategy Tests
 * 
 * Tests for range status detection, strategy classification, and marker positioning.
 * These thresholds can be tuned in production based on user feedback.
 */

import {
  getStrategy, 
  getRangeStatus, 
  calculateMarkerPosition,
  RANGE_STRATEGY_THRESHOLDS 
} from '../PoolRangeIndicator';

describe('RangeBand™ Strategy Classification', () => {
  describe('getStrategy', () => {
    it('should classify narrow ranges as Aggressive (< 12%)', () => {
      const result1 = getStrategy(5);
      expect(result1.label).toBe('Aggressive');
      expect(result1.tone).toBe('narrow');
      expect(result1.pct).toBe(5);

      const result2 = getStrategy(11.9);
      expect(result2.label).toBe('Aggressive');
      expect(result2.tone).toBe('narrow');
    });

    it('should classify medium ranges as Balanced (12% – 35%)', () => {
      const result1 = getStrategy(12.0);
      expect(result1.label).toBe('Balanced');
      expect(result1.tone).toBe('balanced');

      const result2 = getStrategy(25);
      expect(result2.label).toBe('Balanced');
      expect(result2.tone).toBe('balanced');

      const result3 = getStrategy(35.0);
      expect(result3.label).toBe('Balanced');
      expect(result3.tone).toBe('balanced');
    });

    it('should classify wide ranges as Conservative (> 35%)', () => {
      const result1 = getStrategy(35.1);
      expect(result1.label).toBe('Conservative');
      expect(result1.tone).toBe('wide');

      const result2 = getStrategy(50);
      expect(result2.label).toBe('Conservative');
      expect(result2.tone).toBe('wide');

      const result3 = getStrategy(100);
      expect(result3.label).toBe('Conservative');
      expect(result3.tone).toBe('wide');
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
      expect(RANGE_STRATEGY_THRESHOLDS.aggressiveMax).toBe(12);
      expect(RANGE_STRATEGY_THRESHOLDS.balancedMax).toBe(35);
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
    const midpoint = (lower + upper) / 2;
    const rangeWidthPct = Math.abs(((upper - lower) / midpoint) * 100);
    const strategy = getStrategy(rangeWidthPct);

    // This range is ~16.2%, should be Balanced
    expect(strategy.label).toBe('Balanced');
  });

  it('should handle an aggressive (narrow) position', () => {
    const lower = 0.01;
    const upper = 0.0105; // 5% range
    const current = 0.01025;

    const midpoint = (lower + upper) / 2;
    const rangeWidthPct = Math.abs(((upper - lower) / midpoint) * 100);
    const strategy = getStrategy(rangeWidthPct);

    // ~9.8% should be Aggressive
    expect(strategy.label).toBe('Aggressive');
    expect(strategy.pct).toBeLessThan(12);
  });

  it('should handle a conservative (wide) position', () => {
    const lower = 0.01;
    const upper = 0.015; // 50% range
    const current = 0.0125;

    const midpoint = (lower + upper) / 2;
    const rangeWidthPct = Math.abs(((upper - lower) / midpoint) * 100);
    const strategy = getStrategy(rangeWidthPct);

    // ~40% should be Conservative
    expect(strategy.label).toBe('Conservative');
    expect(strategy.pct).toBeGreaterThan(35);
  });
});
