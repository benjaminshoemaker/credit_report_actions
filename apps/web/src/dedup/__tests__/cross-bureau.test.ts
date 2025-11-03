import { describe, expect, it } from 'vitest';
import {
  mergeCrossBureauAccounts,
  type BureauAccount,
  type ReviewAccount,
  type ConflictEntry
} from '../cross-bureau';
import fixture from '../../../test-fixtures/multi-bureau.json';

describe('mergeCrossBureauAccounts', () => {
  const accounts = fixture.accounts as BureauAccount[];

  it('merges tradelines across bureaus with latest-wins logic', () => {
    const result = mergeCrossBureauAccounts(accounts);

    expect(result.mergedAccounts).toHaveLength(2);

    const primary = result.mergedAccounts.find(
      (account: ReviewAccount) => account.name === 'Prime Bank Visa'
    );
    expect(primary).toBeDefined();
    expect(primary?.balance).toBe(1300);
    expect(primary?.creditLimit).toBe(4800);
    expect(primary?.ownership).toBe('joint');
    expect(primary?.bureaus.sort()).toEqual(['equifax', 'transunion'].sort());

    const tieBreaker = result.mergedAccounts.find(
      (account: ReviewAccount) => account.name === 'Metro Line Credit'
    );
    expect(tieBreaker).toBeDefined();
    expect(tieBreaker?.balance).toBe(2100);
    expect(tieBreaker?.creditLimit).toBe(3900);
  });

  it('reports conflicts with latest wins and tie-break metadata', () => {
    const result = mergeCrossBureauAccounts(accounts);
    const balanceConflict = result.conflicts.find(
      (conflict: ConflictEntry) =>
        conflict.accountName === 'Metro Line Credit' && conflict.field === 'balance'
    );
    expect(balanceConflict).toBeDefined();
    expect(balanceConflict?.resolution).toBe('tie_balance');
    expect(balanceConflict?.chosen.bureau).toBe('experian');

    const limitConflict = result.conflicts.find(
      (conflict: ConflictEntry) =>
        conflict.accountName === 'Metro Line Credit' && conflict.field === 'creditLimit'
    );
    expect(limitConflict).toBeDefined();
    expect(limitConflict?.resolution).toBe('tie_limit');
  });

  it('excludes authorized-user lines from merged accounts', () => {
    const result = mergeCrossBureauAccounts(accounts);
    expect(result.excludedAccounts).toHaveLength(1);
    expect(result.excludedAccounts[0]?.name).toBe('Store Card AU');
  });
});
