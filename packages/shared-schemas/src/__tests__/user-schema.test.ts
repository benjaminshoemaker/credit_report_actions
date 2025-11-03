import { describe, expect, it } from 'vitest';
import {
  AccountSchema,
  AnalyzeInputSchema,
  LimitSourceSchema
} from '../index.js';

const baseAccount = {
  id: 'acct-001',
  bureau: 'equifax',
  creditorName: 'Chase Bank',
  productType: 'credit_card',
  ownership: 'individual',
  status: 'open',
  paymentStatus: 'current',
  balance: 2500,
  creditLimit: 5000,
  limitSource: 'reported_limit',
  apr: 21.99,
  disputeCandidate: false,
  disputeReasons: []
} as const;

describe('AnalyzeInputSchema', () => {
  it('validates a well-formed payload', () => {
    const payload = {
      user: { id: 'user-123', scoreBand: 'good' },
      accounts: [baseAccount],
      inquiries: [
        {
          id: 'inq-1',
          bureau: 'equifax',
          creditorName: 'Chase Bank',
          type: 'hard',
          date: '2024-02-03'
        }
      ],
      meta: {
        source: 'upload',
        bureaus: ['equifax'],
        version: 'engine-v1',
        generatedAt: '2024-02-03T10:00:00Z'
      }
    };

    const parsed = AnalyzeInputSchema.parse(payload);
    expect(parsed.accounts[0].balance).toBe(2500);
    expect(parsed.meta?.source).toBe('upload');
  });

  it('fails when required fields are missing', () => {
    const invalidPayload = {
      user: { id: 'user-123', scoreBand: 'good' },
      accounts: [
        {
          ...baseAccount,
          productType: undefined
        }
      ]
    };

    const result = AnalyzeInputSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});

describe('AccountSchema', () => {
  it('accepts supported limit_source values', () => {
    LimitSourceSchema.options.forEach((limitSource) => {
      const parsed = AccountSchema.parse({
        ...baseAccount,
        limitSource
      });
      expect(parsed.limitSource).toBe(limitSource);
    });
  });
});
