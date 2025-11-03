import type { Account, AnalyzeInput, Bureau } from '@shared-schemas';
import type { AnalysisState } from '../state/app-state';

const LOCAL_USER_ID = 'local-user';

const normalizeProductType = (value?: string): Account['productType'] => {
  if (!value) return 'credit_card';
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('charge')) return 'charge_card';
  if (normalized.includes('install')) return 'personal_loan';
  if (normalized.includes('auto')) return 'auto_loan';
  if (normalized.includes('mortgage')) return 'mortgage';
  if (normalized.includes('home')) return 'home_equity';
  if (normalized.includes('secured')) return 'secured_card';
  return 'credit_card';
};

const normalizeStatus = (value?: string): Account['status'] => {
  if (!value) return 'open';
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  const allowed: Account['status'][] = [
    'open',
    'closed',
    'paid',
    'delinquent',
    'charged_off',
    'collection',
    'unknown'
  ];
  if (normalized === 'current') return 'open';
  return (allowed.includes(normalized as Account['status']) ? normalized : 'open') as Account['status'];
};

export const buildAccountsFromAnalysis = (analysis: AnalysisState): Account[] => {
  const edits = new Map(
    analysis.manualEdits.map((edit) => [edit.id.toLowerCase(), edit.fields])
  );

  return analysis.mergedAccounts.map((account) => {
    const edit = edits.get(account.name.toLowerCase());
    const balance = edit?.balance ?? account.balance ?? 0;
    const creditLimit = edit?.creditLimit ?? account.creditLimit ?? null;
    const highCredit = edit?.highCredit ?? account.highCredit ?? null;

    return {
      id: account.id,
      bureau: account.bureaus.length === 1 ? account.bureaus[0] : 'unknown',
      creditorName: account.name,
      productType: normalizeProductType(edit?.productType),
      ownership: (account.ownership ?? 'unknown') as Account['ownership'],
      status: normalizeStatus(edit?.status ?? account.status),
      paymentStatus: 'current',
      balance,
      creditLimit,
      highCredit,
      limitSource: creditLimit ? 'reported_limit' : highCredit ? 'high_credit_proxy' : 'unknown',
      apr: null,
      aprSource: 'unknown',
      openDate: account.openDate,
      lastDelinquencyDate: undefined,
      reportedMonth: account.reportedDate,
      disputeCandidate: false,
      disputeReasons: [],
      tags: account.ownership === 'joint' ? ['joint'] : []
    };
  });
};

export const buildAnalyzeInput = (analysis: AnalysisState): AnalyzeInput => {
  const bureaus = new Set<Bureau>();
  analysis.bureauAccounts.forEach((account) => bureaus.add(account.bureau));
  analysis.mergedAccounts.forEach((account) =>
    account.bureaus.forEach((bureau) => bureaus.add(bureau))
  );

  return {
    user: {
      id: LOCAL_USER_ID,
      scoreBand: 'unknown'
    },
    accounts: buildAccountsFromAnalysis(analysis),
    inquiries: [],
    meta: {
      source: 'upload',
      bureaus: Array.from(bureaus),
      generatedAt: new Date().toISOString(),
      version: '1.0'
    }
  };
};

export { LOCAL_USER_ID };
