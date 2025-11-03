import { describe, expect, it } from 'vitest';
import { evPaydown, simulatePaydown } from '../index.js';

const accounts = [
  { id: 'card-a', balance: 2500, apr: 24.99 },
  { id: 'card-b', balance: 1500, apr: 18.99 }
] as const;

const cloneAccounts = () => accounts.map((acct) => ({ ...acct }));

describe('paydown simulator', () => {
  it('matches expected interest for proportional vs avalanche strategies', () => {
    const proportionalPlan = {
      accounts: cloneAccounts(),
      surplus: 300,
      months: 3,
      strategy: 'proportional' as const
    };

    const avalanchePlan = {
      accounts: cloneAccounts(),
      surplus: 300,
      months: 3,
      strategy: 'avalanche' as const
    };

    const proportional = simulatePaydown(proportionalPlan);
    const avalanche = simulatePaydown(avalanchePlan);

    expect(proportional.interestPaid).toBeCloseTo(205.95, 2);
    expect(avalanche.interestPaid).toBeCloseTo(203.37, 2);
    expect(proportional.balances.get('card-a')).toBeCloseTo(2078.09, 2);
    expect(avalanche.balances.get('card-a')).toBeCloseTo(1731.02, 2);
  });

  it('returns best savings from three-month and avalanche plans', () => {
    const baselinePlan = {
      accounts: cloneAccounts(),
      surplus: 300,
      months: 3,
      strategy: 'proportional' as const
    };

    const avalanchePlan = {
      accounts: cloneAccounts(),
      surplus: 300,
      months: 3,
      strategy: 'avalanche' as const
    };

    const threeMonthPlan = {
      accounts: cloneAccounts(),
      surplus: 300,
      months: 3,
      strategy: 'avalanche' as const,
      lumpSum: 500
    };

    const baselineInterest = simulatePaydown(baselinePlan).interestPaid;
    const avalancheInterest = simulatePaydown(avalanchePlan).interestPaid;
    const threeMonthInterest = simulatePaydown(threeMonthPlan).interestPaid;

    expect(baselineInterest - avalancheInterest).toBeCloseTo(2.58, 2);
    expect(baselineInterest - threeMonthInterest).toBeCloseTo(34.47, 2);

    const ev = evPaydown(threeMonthPlan, baselinePlan, avalanchePlan);
    expect(ev).toBeCloseTo(34.47, 2);
  });
});
