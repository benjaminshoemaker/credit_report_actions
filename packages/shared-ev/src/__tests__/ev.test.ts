import { describe, expect, it } from 'vitest';
import type { ScoreBand } from '@shared-schemas';
import {
  APR_REDUCTION_ODDS_TABLE,
  BALANCE_TRANSFER_ODDS_TABLE,
  DELTA_APR_TABLE,
  MAX_APR,
  MIN_APR,
  PRODUCT_APR_BASELINE,
  SCORE_BAND_ADJUSTMENTS,
  UTILIZATION_BRACKETS,
  aprReductionOdds,
  balanceTransferOdds,
  clampApr,
  estimateApr,
  evAprReduction,
  evBalanceTransfer,
  evLateFee,
  evPenaltyAPR,
  expectedMonthlySavings,
  minPayment,
  scenarioBounds,
  utilBracket,
  type UtilizationBracket
} from '../index.js';

describe('clampApr', () => {
  it('caps APR at configured bounds', () => {
    expect(clampApr(99)).toBe(MAX_APR);
    expect(clampApr(5)).toBe(MIN_APR);
    expect(clampApr(22.456)).toBe(22.46);
  });
});

describe('estimateApr', () => {
  it('applies score band adjustments and clamps result', () => {
    const base = PRODUCT_APR_BASELINE.credit_card;
    const adjustment = SCORE_BAND_ADJUSTMENTS.good;
    const expected = Math.min(
      MAX_APR,
      Math.max(MIN_APR, Number((base + base * adjustment).toFixed(2)))
    );

    expect(estimateApr('credit_card', 'good')).toBe(expected);
  });

  it('clamps low estimates to minimum APR', () => {
    expect(estimateApr('mortgage', 'excellent')).toBe(MIN_APR);
  });
});

describe('minPayment', () => {
  it('floors to minimum payment when calculation is below threshold', () => {
    expect(minPayment(24, 19.99)).toBe(25);
  });

  it('scales with balance and APR', () => {
    expect(minPayment(1000, 24.99)).toBeGreaterThan(25);
  });
});

describe('utilBracket', () => {
  const targets = [9, 10, 29, 30, 49, 50, 79, 80] as const;
  const expectedLabels = [
    'under_10',
    'under_30',
    'under_30',
    'under_50',
    'under_50',
    'under_80',
    'under_80',
    'over_80'
  ];

  targets.forEach((value, index) => {
    it(`maps utilization ${value}% to ${expectedLabels[index]}`, () => {
      expect(utilBracket(value)).toBe(expectedLabels[index]);
    });
  });

  it('defaults negative values to lowest bracket', () => {
    expect(utilBracket(-5)).toBe(UTILIZATION_BRACKETS[0].label);
  });
});

describe('expectedMonthlySavings', () => {
  it('returns zero for non-positive balances', () => {
    expect(expectedMonthlySavings(0, 24.5, 'good')).toBe(0);
  });

  it('returns positive savings when APR improves for high score bands', () => {
    const savings = expectedMonthlySavings(1500, 24.5, 'excellent');
    expect(savings).toBeGreaterThan(0);
  });
});

describe('aprReductionOdds', () => {
  it('matches base table values when pristine', () => {
    Object.entries(APR_REDUCTION_ODDS_TABLE).forEach(([band, brackets]) => {
      Object.entries(brackets).forEach(([label, value]) => {
        expect(aprReductionOdds(band as ScoreBand, label as UtilizationBracket, false)).toBeCloseTo(value, 2);
      });
    });
  });

  it('applies late-payment penalty and clamps output', () => {
    const odds = aprReductionOdds('good', 'under_10', true);
    expect(odds).toBeCloseTo(APR_REDUCTION_ODDS_TABLE.good.under_10 * 0.45, 2);
  });
});

describe('balanceTransferOdds', () => {
  it('matches base table values', () => {
    Object.entries(BALANCE_TRANSFER_ODDS_TABLE).forEach(([band, brackets]) => {
      Object.entries(brackets).forEach(([label, value]) => {
        expect(balanceTransferOdds(band as ScoreBand, label as UtilizationBracket, false)).toBeCloseTo(value, 2);
      });
    });
  });

  it('reduces odds when recent lates exist', () => {
    const odds = balanceTransferOdds('fair', 'over_80', true);
    expect(odds).toBeCloseTo(BALANCE_TRANSFER_ODDS_TABLE.fair.over_80 * 0.45, 5);
  });

  it('clamps to range across edge conditions', () => {
    const odds = balanceTransferOdds('poor', 'over_80', true);
    expect(odds).toBeGreaterThanOrEqual(0);
    expect(odds).toBeLessThanOrEqual(1);
  });
});

describe('expected value helpers', () => {
  it('computes EV for late fee refunds', () => {
    expect(evLateFee(0.6, 40)).toBe(24);
  });

  it('computes EV for penalty APR reversion', () => {
    const ev = evPenaltyAPR(0.5, 10, 1200, 3);
    // Expected monthly savings: (10/100/12)*1200 ≈ 10
    // EV: 0.5 * 10 * 3 = 15
    expect(ev).toBe(15);
  });

  it('computes EV for APR reduction success', () => {
    const ev = evAprReduction(0.4, 6, 2000, 4);
    // Monthly savings ≈ (0.06/12)*2000 = 10
    // EV: 0.4 * 10 * 4 = 16
    expect(ev).toBe(16);
  });

  it('computes EV for balance transfer approvals', () => {
    const ev = evBalanceTransfer(0.4, 24, 2000, 0.03, 6);
    expect(ev).toBe(72);
  });
});

describe('scenarioBounds', () => {
  it('shifts a tier down and up for middle tiers', () => {
    const [low, high] = scenarioBounds('good', (band) => DELTA_APR_TABLE[band]);
    expect(low).toBe(DELTA_APR_TABLE.fair);
    expect(high).toBe(DELTA_APR_TABLE.very_good);
  });

  it('handles bottom tier without going past bounds', () => {
    const [low, high] = scenarioBounds('poor', (band) => DELTA_APR_TABLE[band]);
    expect(low).toBe(DELTA_APR_TABLE.poor);
    expect(high).toBe(DELTA_APR_TABLE.fair);
  });

  it('treats unknown as mid tier', () => {
    const [low, high] = scenarioBounds('unknown', (band) => DELTA_APR_TABLE[band]);
    expect(low).toBe(DELTA_APR_TABLE.poor);
    expect(high).toBe(DELTA_APR_TABLE.good);
  });
});
