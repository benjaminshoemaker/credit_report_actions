import type { ProductType, ScoreBand } from '@shared-schemas';

export const MIN_APR = 9.99;
export const MAX_APR = 34.99;

const toCents = (value: number): number => Number(value.toFixed(2));

export const clampApr = (apr: number): number => {
  if (!Number.isFinite(apr)) {
    throw new Error('APR must be a finite number');
  }

  return Math.min(MAX_APR, Math.max(MIN_APR, toCents(apr)));
};

export const UTILIZATION_BRACKETS = [
  { max: 9, label: 'under_10' },
  { max: 29, label: 'under_30' },
  { max: 49, label: 'under_50' },
  { max: 79, label: 'under_80' },
  { max: Infinity, label: 'over_80' }
] as const;

export type UtilizationBracket = (typeof UTILIZATION_BRACKETS)[number]['label'];

export const utilBracket = (utilPercent: number): UtilizationBracket => {
  if (!Number.isFinite(utilPercent) || utilPercent < 0) {
    return 'under_10';
  }

  const bracket = UTILIZATION_BRACKETS.find(({ max }) => utilPercent <= max);
  return bracket?.label ?? 'over_80';
};

export const SCORE_BAND_ADJUSTMENTS: Record<ScoreBand, number> = {
  excellent: -0.05,
  very_good: -0.03,
  good: -0.015,
  fair: 0.01,
  poor: 0.03,
  unknown: 0.02
};

export const PRODUCT_APR_BASELINE: Record<ProductType, number> = {
  credit_card: 24.99,
  charge_card: 23.5,
  personal_loan: 18.99,
  auto_loan: 9.5,
  student_loan: 7.1,
  mortgage: 6.5,
  home_equity: 8.2,
  secured_card: 26.99,
  other: 19.99
};

export const estimateApr = (productType: ProductType, scoreBand: ScoreBand): number => {
  const base = PRODUCT_APR_BASELINE[productType] ?? PRODUCT_APR_BASELINE.other;
  const adjustment = SCORE_BAND_ADJUSTMENTS[scoreBand] ?? 0;
  const estimated = base + base * adjustment;
  return clampApr(estimated);
};

const MIN_PAYMENT_FLOOR = 25;
const MIN_PAYMENT_RATIO = 0.02;

export const minPayment = (balance: number, apr: number): number => {
  if (balance <= 0) {
    return 0;
  }

  const percentage = balance * MIN_PAYMENT_RATIO;
  const aprComponent = (balance * (apr / 100)) / 12;
  const raw = percentage + aprComponent;
  return Math.max(MIN_PAYMENT_FLOOR, Math.ceil(raw));
};

export const expectedMonthlySavings = (
  balance: number,
  currentApr: number,
  band: ScoreBand
): number => {
  if (balance <= 0) {
    return 0;
  }

  const newApr = clampApr(currentApr + currentApr * SCORE_BAND_ADJUSTMENTS[band]);
  const monthlyRateDelta = (currentApr - newApr) / 12 / 100;
  return toCents(balance * monthlyRateDelta);
};

type OddsTable = Record<ScoreBand, Record<UtilizationBracket, number>>;

export const APR_REDUCTION_ODDS_TABLE: OddsTable = {
  excellent: {
    under_10: 0.85,
    under_30: 0.78,
    under_50: 0.62,
    under_80: 0.44,
    over_80: 0.22
  },
  very_good: {
    under_10: 0.8,
    under_30: 0.7,
    under_50: 0.53,
    under_80: 0.35,
    over_80: 0.18
  },
  good: {
    under_10: 0.7,
    under_30: 0.58,
    under_50: 0.42,
    under_80: 0.26,
    over_80: 0.12
  },
  fair: {
    under_10: 0.55,
    under_30: 0.4,
    under_50: 0.25,
    under_80: 0.15,
    over_80: 0.06
  },
  poor: {
    under_10: 0.35,
    under_30: 0.22,
    under_50: 0.12,
    under_80: 0.05,
    over_80: 0.02
  },
  unknown: {
    under_10: 0.45,
    under_30: 0.32,
    under_50: 0.18,
    under_80: 0.11,
    over_80: 0.05
  }
};

export const BALANCE_TRANSFER_ODDS_TABLE: OddsTable = {
  excellent: {
    under_10: 0.75,
    under_30: 0.68,
    under_50: 0.55,
    under_80: 0.36,
    over_80: 0.18
  },
  very_good: {
    under_10: 0.7,
    under_30: 0.6,
    under_50: 0.46,
    under_80: 0.3,
    over_80: 0.15
  },
  good: {
    under_10: 0.6,
    under_30: 0.5,
    under_50: 0.35,
    under_80: 0.22,
    over_80: 0.1
  },
  fair: {
    under_10: 0.45,
    under_30: 0.32,
    under_50: 0.2,
    under_80: 0.12,
    over_80: 0.04
  },
  poor: {
    under_10: 0.28,
    under_30: 0.18,
    under_50: 0.1,
    under_80: 0.03,
    over_80: 0.01
  },
  unknown: {
    under_10: 0.38,
    under_30: 0.26,
    under_50: 0.15,
    under_80: 0.08,
    over_80: 0.03
  }
};

const lookupOdds = (
  table: OddsTable,
  scoreBand: ScoreBand,
  util: UtilizationBracket
): number => {
  const band = table[scoreBand] ? scoreBand : 'unknown';
  return table[band][util] ?? table[band].over_80;
};

const clampProbability = (value: number): number => Math.min(1, Math.max(0, value));

const LATE_PENALTY = 0.45;

export const aprReductionOdds = (
  scoreBand: ScoreBand,
  usage: UtilizationBracket,
  any60dLate: boolean
): number => {
  const base = lookupOdds(APR_REDUCTION_ODDS_TABLE, scoreBand, usage);
  const adjusted = any60dLate ? base * LATE_PENALTY : base;
  return clampProbability(adjusted);
};

export const balanceTransferOdds = (
  scoreBand: ScoreBand,
  usage: UtilizationBracket,
  any60dLate: boolean
): number => {
  const base = lookupOdds(BALANCE_TRANSFER_ODDS_TABLE, scoreBand, usage);
  const adjusted = any60dLate ? base * LATE_PENALTY : base;
  return clampProbability(adjusted);
};

export const DELTA_APR_TABLE: Record<ScoreBand, number> = {
  excellent: 8,
  very_good: 6,
  good: 4,
  fair: 3,
  poor: 2,
  unknown: 3.5
};

export const evLateFee = (pRefund: number, feeAmount: number): number => {
  if (pRefund <= 0 || feeAmount <= 0) {
    return 0;
  }

  return toCents(clampProbability(pRefund) * feeAmount);
};

export const evPenaltyAPR = (
  pReversion: number,
  deltaApr: number,
  avgBalance: number,
  monthsActive: number
): number => {
  if (pReversion <= 0 || deltaApr <= 0 || avgBalance <= 0 || monthsActive <= 0) {
    return 0;
  }

  const monthlySavings = (deltaApr / 100 / 12) * avgBalance;
  return toCents(clampProbability(pReversion) * monthlySavings * monthsActive);
};

export const evAprReduction = (
  pSuccess: number,
  deltaApr: number,
  avgBalance: number,
  monthsActive: number
): number => {
  if (pSuccess <= 0 || deltaApr <= 0 || avgBalance <= 0 || monthsActive <= 0) {
    return 0;
  }

  const monthlySavings = (deltaApr / 100 / 12) * avgBalance;
  return toCents(clampProbability(pSuccess) * monthlySavings * monthsActive);
};

export const evBalanceTransfer = (
  pApproval: number,
  aprSrc: number,
  amountTransferred: number,
  feeRate: number,
  monthsActive: number
): number => {
  if (
    pApproval <= 0 ||
    aprSrc <= 0 ||
    amountTransferred <= 0 ||
    feeRate < 0 ||
    monthsActive <= 0
  ) {
    return 0;
  }

  const interestSavings = (aprSrc / 100 / 12) * amountTransferred * monthsActive;
  const transferFee = amountTransferred * feeRate;
  const netSavings = interestSavings - transferFee;
  if (netSavings <= 0) {
    return 0;
  }

  return toCents(clampProbability(pApproval) * netSavings);
};

const SCORE_BAND_ORDER: ScoreBand[] = ['poor', 'fair', 'good', 'very_good', 'excellent'];

const normalizeBand = (band: ScoreBand): ScoreBand => {
  if (band === 'unknown' || !SCORE_BAND_ORDER.includes(band)) {
    return 'fair';
  }

  return band;
};

export const scenarioBounds = (
  scoreBand: ScoreBand,
  lookup: (band: ScoreBand) => number
): [number, number] => {
  const effectiveBand = normalizeBand(scoreBand);
  const index = SCORE_BAND_ORDER.indexOf(effectiveBand);
  const downBand = SCORE_BAND_ORDER[Math.max(0, index - 1)];
  const upBand = SCORE_BAND_ORDER[Math.min(SCORE_BAND_ORDER.length - 1, index + 1)];

  return [lookup(downBand), lookup(upBand)];
};

export type PaydownStrategy = 'proportional' | 'avalanche';

export type PaydownAccount = {
  id: string;
  balance: number;
  apr: number;
};

export type PaydownPlanInput = {
  accounts: PaydownAccount[];
  surplus: number;
  months: number;
  strategy: PaydownStrategy;
  lumpSum?: number;
};

export type PaydownSimulationResult = {
  interestPaid: number;
  balances: Map<string, number>;
};

const sortAccounts = (accounts: PaydownAccount[], strategy: PaydownStrategy): PaydownAccount[] =>
  [...accounts].sort((a, b) => {
    if (strategy === 'avalanche') {
      return b.apr - a.apr;
    }
    return a.balance - b.balance;
  });

const proportionatePayment = (
  accounts: PaydownAccount[],
  surplus: number
): Map<string, number> => {
  const positive = accounts.filter((account) => account.balance > 0);
  const totalBalance = positive.reduce((sum, account) => sum + account.balance, 0);
  const payments = new Map<string, number>();
  positive.forEach((account) => {
    const share = totalBalance === 0 ? 0 : (account.balance / totalBalance) * surplus;
    payments.set(account.id, share);
  });
  return payments;
};

const avalanchePayment = (
  accounts: PaydownAccount[],
  surplus: number
): Map<string, number> => {
  const payments = new Map<string, number>();
  let remaining = surplus;

  for (const account of accounts) {
    if (remaining <= 0 || account.balance <= 0) {
      payments.set(account.id, 0);
      continue;
    }

    const pay = Math.min(account.balance, remaining);
    payments.set(account.id, pay);
    remaining -= pay;
  }

  if (remaining > 0) {
    const account = accounts[accounts.length - 1];
    payments.set(account.id, (payments.get(account.id) ?? 0) + remaining);
  }

  return payments;
};

const applyLumpSum = (
  accounts: PaydownAccount[],
  lumpSum: number | undefined,
  strategy: PaydownStrategy
): void => {
  if (!lumpSum || lumpSum <= 0) {
    return;
  }

  if (strategy === 'proportional') {
    const allocations = proportionatePayment(accounts, lumpSum);
    accounts.forEach((account) => {
      account.balance = Math.max(0, account.balance - (allocations.get(account.id) ?? 0));
    });
  } else {
    const allocations = avalanchePayment(sortAccounts(accounts, 'avalanche'), lumpSum);
    accounts.forEach((account) => {
      account.balance = Math.max(0, account.balance - (allocations.get(account.id) ?? 0));
    });
  }
};

const simulateStrategy = ({
  accounts: initialAccounts,
  months,
  surplus,
  strategy,
  lumpSum
}: PaydownPlanInput): PaydownSimulationResult => {
  const accounts = initialAccounts.map((acct) => ({ ...acct }));
  let totalInterest = 0;

  applyLumpSum(accounts, lumpSum, strategy);

  for (let month = 0; month < months; month += 1) {
    const ordered = sortAccounts(accounts, strategy);
    const payments =
      strategy === 'proportional'
        ? proportionatePayment(ordered, surplus)
        : avalanchePayment(ordered, surplus);

    ordered.forEach((account) => {
      const payment = payments.get(account.id) ?? 0;
      const prevBalance = account.balance;
      const newBalance = Math.max(0, prevBalance - payment);
      const averageBalance = (prevBalance + newBalance) / 2;
      const interest = (account.apr / 100 / 12) * averageBalance;
      totalInterest += interest;
      account.balance = newBalance + interest;
    });
  }

  return {
    interestPaid: toCents(totalInterest),
    balances: new Map(accounts.map((acct) => [acct.id, toCents(acct.balance)]))
  };
};

export const simulatePaydown = (plan: PaydownPlanInput): PaydownSimulationResult =>
  simulateStrategy(plan);

export type PaydownScenario = {
  threeMonth: PaydownPlanInput;
  baselineB: PaydownPlanInput;
  avalanche: PaydownPlanInput;
};

export const evPaydown = (
  threeMonth: PaydownPlanInput,
  baselineB: PaydownPlanInput,
  avalanche: PaydownPlanInput
): number => {
  const threeMonthResult = simulateStrategy(threeMonth);
  const baselineResult = simulateStrategy(baselineB);
  const avalancheResult = simulateStrategy(avalanche);

  const baselineTotal = baselineResult.interestPaid;
  const threeMonthTotal = threeMonthResult.interestPaid;
  const avalancheTotal = avalancheResult.interestPaid;

  const savingsThreeMonth = baselineTotal - threeMonthTotal;
  const savingsAvalanche = baselineTotal - avalancheTotal;

  return toCents(Math.max(0, Math.max(savingsThreeMonth, savingsAvalanche)));
};
