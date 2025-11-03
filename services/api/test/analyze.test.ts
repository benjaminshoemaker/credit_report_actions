import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const enforceUsageCapMock = vi.fn();

class MockUsageCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageCapError';
  }
}

vi.mock('../src/db.js', () => ({
  ensureMigrations: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../src/usage/caps.js', () => ({
  enforceUsageCap: enforceUsageCapMock,
  UsageCapError: MockUsageCapError
}));

let analyzeHandler: typeof import('../src/handlers/analyze.js')['handler'];

beforeAll(async () => {
  ({ handler: analyzeHandler } = await import('../src/handlers/analyze.js'));
});

beforeEach(() => {
  enforceUsageCapMock.mockResolvedValue(undefined);
});

const buildEvent = (body: unknown) => ({
  body: JSON.stringify(body)
}) as any;

describe('POST /analyze handler', () => {
  it('computes APR reduction and balance transfer actions', async () => {
    const event = buildEvent({
      user: { id: 'user-1', scoreBand: 'good' },
      accounts: [
        {
          id: 'acct-1',
          bureau: 'equifax',
          creditorName: 'Test Bank',
          productType: 'credit_card',
          ownership: 'individual',
          status: 'open',
          paymentStatus: 'current',
          balance: 2000,
          creditLimit: 5000,
          highCredit: 5200,
          limitSource: 'reported_limit',
          apr: 24.5,
          aprSource: 'reported',
          tags: []
        },
        {
          id: 'acct-2',
          bureau: 'experian',
          creditorName: 'Everyday Cash',
          productType: 'credit_card',
          ownership: 'joint',
          status: 'open',
          paymentStatus: 'current',
          balance: 1500,
          creditLimit: null,
          highCredit: 4000,
          limitSource: 'high_credit_proxy',
          apr: null,
          aprSource: 'unknown',
          tags: []
        }
      ],
      inquiries: [],
      flags: {
        any60dLate: false
      }
    });

    const response = await analyzeHandler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body ?? '{}');
    const actionTypes = body.actions.map((action: any) => action.type);
    expect(actionTypes).toContain('apr_reduction');
    expect(actionTypes).toContain('balance_transfer');

    const aprAction = body.actions.find((action: any) => action.type === 'apr_reduction');
    expect(aprAction.estimatedSavingsUsd).toBeGreaterThan(0);
    expect(aprAction.metadata.whyThis[0]).toMatch(/revolving balances/i);
    expect(aprAction.scenarioRange.low).toBeLessThanOrEqual(aprAction.scenarioRange.high);

    const btAction = body.actions.find((action: any) => action.type === 'balance_transfer');
    expect(btAction.estimatedSavingsUsd).toBeGreaterThan(0);
    expect(btAction.metadata.cashNeededUsd).toBeGreaterThan(0);

    expect(body.warnings).toEqual([]);
    expect(body.audit.engineVersion).toBe('v1.0.0');
    expect(body.audit.computeMs).toBeTypeOf('number');
  });

  it('includes late-fee and penalty actions when prompts supplied', async () => {
    const event = buildEvent({
      user: { id: 'user-2', scoreBand: 'fair' },
      accounts: [
        {
          id: 'acct-1',
          bureau: 'equifax',
          creditorName: 'Penalty Card',
          productType: 'credit_card',
          ownership: 'individual',
          status: 'open',
          paymentStatus: 'current',
          balance: 1800,
          creditLimit: 3000,
          highCredit: null,
          limitSource: 'reported_limit',
          apr: 29.99,
          aprSource: 'reported',
          tags: []
        },
        {
          id: 'acct-2',
          bureau: 'transunion',
          creditorName: 'Low Limit Card',
          productType: 'credit_card',
          ownership: 'individual',
          status: 'open',
          paymentStatus: 'current',
          balance: 1600,
          creditLimit: null,
          highCredit: null,
          limitSource: 'unknown',
          apr: null,
          aprSource: 'unknown',
          tags: []
        }
      ],
      inquiries: [],
      flags: {
        any60dLate: true,
        lateFeeLastTwoStatements: true,
        penaltyAprActive: true
      }
    });

    const response = await analyzeHandler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body ?? '{}');
    const actionTypes = body.actions.map((action: any) => action.type);
    expect(actionTypes).toEqual(
      expect.arrayContaining(['late_fee_reversal', 'penalty_apr_reduction'])
    );

    const penaltyAction = body.actions.find(
      (action: any) => action.type === 'penalty_apr_reduction'
    );
    expect(penaltyAction.estimatedSavingsUsd).toBeGreaterThan(0);
    expect(body.warnings[0]?.code).toBe('missing_limits');
  });

  it('returns 400 for invalid payloads', async () => {
    const response = await analyzeHandler(buildEvent({}));
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('invalid_request');
  });

  it('returns 429 when usage cap exceeded', async () => {
    enforceUsageCapMock.mockRejectedValueOnce(new MockUsageCapError('cap exceeded'));
    const response = await analyzeHandler(
      buildEvent({
        user: { id: 'user-99', scoreBand: 'good' },
        accounts: [],
        inquiries: []
      })
    );
    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error.code).toBe('usage_cap_exceeded');
  });
});
