import type { Bureau } from '@shared-schemas';
import type { ParsedAccount } from '../parsing/equifax';

export type BureauAccount = ParsedAccount & {
  bureau: Bureau;
};

export type FieldSnapshot = {
  bureau: Bureau;
  value: string | number | undefined;
  reportedDate?: string;
};

export type ConflictField =
  | 'balance'
  | 'creditLimit'
  | 'highCredit'
  | 'status'
  | 'ownership'
  | 'openDate'
  | 'reportedDate';

export type ConflictResolution = 'latest' | 'tie_balance' | 'tie_limit';

export type ConflictEntry = {
  accountName: string;
  field: ConflictField;
  chosen: FieldSnapshot;
  others: FieldSnapshot[];
  resolution: ConflictResolution;
};

export type SourceAccountSnapshot = {
  bureau: Bureau;
  reportedDate?: string;
  balance?: number;
  creditLimit?: number;
  highCredit?: number;
  ownership?: string;
  status?: string;
};

export type ReviewAccount = {
  id: string;
  name: string;
  bureaus: Bureau[];
  ownership?: string;
  status?: string;
  balance?: number;
  creditLimit?: number;
  highCredit?: number;
  openDate?: string;
  reportedDate?: string;
  sourceAccounts: SourceAccountSnapshot[];
};

export type MergeResult = {
  mergedAccounts: ReviewAccount[];
  excludedAccounts: ReviewAccount[];
  conflicts: ConflictEntry[];
};

type TieStrategy = 'max' | 'min' | 'none';

const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') || 'unknown_account';

const reportedDateScore = (reportedDate?: string): number => {
  if (!reportedDate) return 0;
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(reportedDate);
  if (!match) return 0;
  const year = Number.parseInt(match[1], 10);
  const month = match[2] ? Number.parseInt(match[2], 10) : 1;
  return year * 12 + month;
};

const valuesDiffer = (
  a: string | number | undefined,
  b: string | number | undefined
): boolean => {
  if (a === undefined && b === undefined) return false;
  return a !== b;
};

const chooseSnapshot = <T extends string | number | undefined>(
  accounts: BureauAccount[],
  getValue: (account: BureauAccount) => T,
  tieStrategy: TieStrategy
): { snapshot: FieldSnapshot | null; conflicts: FieldSnapshot[]; resolution: ConflictResolution } => {
  const candidates = accounts
    .map((account) => ({
      account,
      value: getValue(account)
    }))
    .filter(({ value }) => value !== undefined && value !== null) as Array<{
    account: BureauAccount;
    value: T;
  }>;

  if (candidates.length === 0) {
    return { snapshot: null, conflicts: [], resolution: 'latest' };
  }

  const sorted = candidates.sort((a, b) => {
    const scoreA = reportedDateScore(a.account.reportedDate);
    const scoreB = reportedDateScore(b.account.reportedDate);
    if (scoreA === scoreB) {
      return 0;
    }
    return scoreB - scoreA;
  });

  const topScore = reportedDateScore(sorted[0].account.reportedDate);
  const topCandidates = sorted.filter(
    ({ account }) => reportedDateScore(account.reportedDate) === topScore
  );

  let winner = topCandidates[0];
  let resolution: ConflictResolution = 'latest';

  if (topCandidates.length > 1 && tieStrategy !== 'none') {
    if (tieStrategy === 'max') {
      winner = topCandidates.reduce((current, candidate) =>
        Number(candidate.value ?? -Infinity) > Number(current.value ?? -Infinity) ? candidate : current
      );
      resolution = 'tie_balance';
    } else if (tieStrategy === 'min') {
      winner = topCandidates.reduce((current, candidate) =>
        Number(candidate.value ?? Infinity) < Number(current.value ?? Infinity) ? candidate : current
      );
      resolution = 'tie_limit';
    }
  }

  const snapshot: FieldSnapshot = {
    bureau: winner.account.bureau,
    value: winner.value,
    reportedDate: winner.account.reportedDate
  };

  const conflicts = sorted
    .filter(({ account, value }) => {
      if (account === winner.account) return false;
      return valuesDiffer(value, winner.value);
    })
    .map(({ account, value }) => ({
      bureau: account.bureau,
      value,
      reportedDate: account.reportedDate
    }));

  return { snapshot, conflicts, resolution };
};

const buildSourceSnapshots = (accounts: BureauAccount[]): SourceAccountSnapshot[] =>
  accounts.map((account) => ({
    bureau: account.bureau,
    reportedDate: account.reportedDate,
    balance: account.balance,
    creditLimit: account.creditLimit,
    highCredit: account.highCredit,
    ownership: account.ownership,
    status: account.status
  }));

const mergeGroup = (accounts: BureauAccount[], id: string): {
  account: ReviewAccount;
  conflicts: ConflictEntry[];
} => {
  const name = accounts[0]?.name ?? 'Unknown account';
  const bureaus = Array.from(new Set(accounts.map((account) => account.bureau)));

  const conflictEntries: ConflictEntry[] = [];

  const resolveField = <T extends string | number | undefined>(
    field: ConflictField,
    getter: (account: BureauAccount) => T,
    tieStrategy: TieStrategy = 'none'
  ): T | undefined => {
    const { snapshot, conflicts, resolution } = chooseSnapshot(accounts, getter, tieStrategy);
    if (snapshot && conflicts.length > 0) {
      conflictEntries.push({
        accountName: name,
        field,
        chosen: snapshot,
        others: conflicts,
        resolution
      });
    }
    return snapshot?.value as T | undefined;
  };

  const balance = resolveField('balance', (account) => account.balance, 'max');
  const creditLimit = resolveField('creditLimit', (account) => account.creditLimit, 'min');
  const highCredit = resolveField('highCredit', (account) => account.highCredit, 'max');
  const status = resolveField('status', (account) => account.status, 'none');
  const ownership = resolveField('ownership', (account) => account.ownership, 'none');
  const openDate = resolveField('openDate', (account) => account.openDate, 'none');
  const reportedDate = resolveField('reportedDate', (account) => account.reportedDate, 'none');

  const account: ReviewAccount = {
    id,
    name,
    bureaus,
    ownership: ownership as string | undefined,
    status: status as string | undefined,
    balance: typeof balance === 'number' ? balance : undefined,
    creditLimit: typeof creditLimit === 'number' ? creditLimit : undefined,
    highCredit: typeof highCredit === 'number' ? highCredit : undefined,
    openDate: openDate as string | undefined,
    reportedDate: reportedDate as string | undefined,
    sourceAccounts: buildSourceSnapshots(accounts)
  };

  return { account, conflicts: conflictEntries };
};

export const mergeCrossBureauAccounts = (accounts: BureauAccount[]): MergeResult => {
  if (accounts.length === 0) {
    return { mergedAccounts: [], excludedAccounts: [], conflicts: [] };
  }

  const grouped = accounts.reduce<Record<string, BureauAccount[]>>((acc, account) => {
    const key = normalizeName(account.name);
    acc[key] = acc[key] ? [...acc[key], account] : [account];
    return acc;
  }, {});

  const conflicts: ConflictEntry[] = [];
  const mergedAccounts: ReviewAccount[] = [];
  const excludedAccounts: ReviewAccount[] = [];

  const keys = Object.keys(grouped).sort();

  keys.forEach((key, index) => {
    const groupAccounts = grouped[key];
    const result = mergeGroup(groupAccounts, `${key}-${index}`);
    conflicts.push(...result.conflicts);
    if (result.account.ownership === 'authorized_user') {
      excludedAccounts.push(result.account);
    } else {
      mergedAccounts.push(result.account);
    }
  });

  return { mergedAccounts, excludedAccounts, conflicts };
};
