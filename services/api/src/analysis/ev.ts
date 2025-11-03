import {
  DELTA_APR_TABLE,
  aprReductionOdds,
  balanceTransferOdds,
  clampApr,
  estimateApr,
  evAprReduction,
  evBalanceTransfer,
  evLateFee,
  evPenaltyAPR,
  scenarioBounds,
  utilBracket,
  type UtilizationBracket
} from '@shared-ev';
import type {
  Account,
  Action,
  ActionMetadata,
  AnalyzeFlags,
  AnalyzeInput,
  ScoreBand,
  ScoreImpact,
  Warning
} from '@shared-schemas';

const REVOLVING_PRODUCTS = new Set<Account['productType']>([
  'credit_card',
  'charge_card',
  'secured_card'
]);

const UTILIZATION_ORDER: UtilizationBracket[] = [
  'under_10',
  'under_30',
  'under_50',
  'under_80',
  'over_80'
];

const UTILIZATION_LABEL: Record<UtilizationBracket, string> = {
  under_10: '<10%',
  under_30: '10–30%',
  under_50: '30–50%',
  under_80: '50–80%',
  over_80: '>80%'
};

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});

type RevolvingAccount = Account & {
  apr: number | null | undefined;
  creditLimit: number | null | undefined;
  highCredit: number | null | undefined;
};

const asRevolving = (account: Account): account is RevolvingAccount =>
  REVOLVING_PRODUCTS.has(account.productType) && account.status === 'open';

const toApr = (account: RevolvingAccount, scoreBand: ScoreBand): number =>
  account.apr && account.apr > 0 ? clampApr(account.apr) : estimateApr(account.productType, scoreBand);

type AggregatedBalances = {
  totalBalance: number;
  knownLimitBalance: number;
  knownLimits: number;
  missingLimitBalance: number;
};

const aggregateBalances = (accounts: RevolvingAccount[]): AggregatedBalances =>
  accounts.reduce<AggregatedBalances>(
    (acc, account) => {
      const balance = Math.max(0, account.balance);
      const creditLimit = account.creditLimit ?? account.highCredit ?? null;

      acc.totalBalance += balance;

      if (creditLimit && creditLimit > 0) {
        acc.knownLimits += creditLimit;
        acc.knownLimitBalance += balance;
      } else {
        acc.missingLimitBalance += balance;
      }

      return acc;
    },
    {
      totalBalance: 0,
      knownLimitBalance: 0,
      knownLimits: 0,
      missingLimitBalance: 0
    }
  );

const bumpBracket = (label: UtilizationBracket): UtilizationBracket => {
  const index = UTILIZATION_ORDER.indexOf(label);
  if (index === -1) return label;
  return UTILIZATION_ORDER[Math.min(index + 1, UTILIZATION_ORDER.length - 1)];
};

const toPercent = (value: number, total: number): number =>
  total === 0 ? 0 : (value / total) * 100;

const roundCurrency = (value: number): number => Number(value.toFixed(2));

const buildAprReductionAction = (
  scoreBand: ScoreBand,
  util: UtilizationBracket,
  balanceTotal: number,
  any60dLate: boolean,
  evHaircut: number
): Action | null => {
  if (balanceTotal <= 0) return null;

  const deltaApr = DELTA_APR_TABLE[scoreBand] ?? DELTA_APR_TABLE.unknown;
  const monthsActive = 6;
  const probability = aprReductionOdds(scoreBand, util, any60dLate);
  const savings = roundCurrency(evAprReduction(probability, deltaApr, balanceTotal, monthsActive) * evHaircut);

  if (savings <= 0) {
    return null;
  }

  const computeScenario = (band: ScoreBand) => {
    const p = aprReductionOdds(band, util, any60dLate);
    const delta = DELTA_APR_TABLE[band] ?? DELTA_APR_TABLE.unknown;
    return evAprReduction(p, delta, balanceTotal, monthsActive) * evHaircut;
  };

  const [low, high] = scenarioBounds(scoreBand, (band) => roundCurrency(computeScenario(band)));

  const utilizationLabel = UTILIZATION_LABEL[util] ?? 'unknown';

  const metadata: ActionMetadata = {
    cashNeededUsd: 0,
    timeToEffectMonths: monthsActive,
    scoreImpact: 'medium',
    whyThis: [
      `About ${usd.format(balanceTotal)} in revolving balances.`,
      `Utilization bracket ${utilizationLabel}.`,
      `Estimated savings assumes ${Math.round(probability * 100)}% success for your profile.`
    ]
  };

  return {
    id: 'action-apr-reduction',
    type: 'apr_reduction',
    title: 'Request an APR reduction',
    summary: `Call your issuer and ask for a lower rate. With ${utilizationLabel} utilization, success is around ${Math.round(probability * 100)}%.`,
    estimatedSavingsUsd: savings,
    probabilityOfSuccess: Number(probability.toFixed(3)),
    scenarioRange: { low: roundCurrency(low), high: roundCurrency(high) },
    nextSteps: [
      'Call the customer service number on the back of the card.',
      'Ask for a rate review citing on-time history and utilization plans.',
      'Escalate to a supervisor if the first rep cannot assist.'
    ],
    tags: ['apr', 'phone-call'],
    metadata
  };
};

const buildBalanceTransferAction = (
  scoreBand: ScoreBand,
  util: UtilizationBracket,
  balanceTotal: number,
  weightedApr: number,
  any60dLate: boolean,
  evHaircut: number
): Action | null => {
  if (balanceTotal <= 0 || weightedApr <= 0) return null;

  const amountToTransfer = Math.min(balanceTotal * 0.7, 5000);
  if (amountToTransfer <= 0) return null;

  const feeRate = 0.03;
  const monthsActive = 2.67;
  const probability = balanceTransferOdds(scoreBand, util, any60dLate);
  const savings = roundCurrency(
    evBalanceTransfer(probability, weightedApr, amountToTransfer, feeRate, monthsActive) * evHaircut
  );

  if (savings <= 0) {
    return null;
  }

  const computeScenario = (band: ScoreBand) => {
    const p = balanceTransferOdds(band, util, any60dLate);
    return evBalanceTransfer(p, weightedApr, amountToTransfer, feeRate, monthsActive) * evHaircut;
  };

  const [low, high] = scenarioBounds(scoreBand, (band) => roundCurrency(computeScenario(band)));
  const fee = roundCurrency(amountToTransfer * feeRate);

  const metadata: ActionMetadata = {
    cashNeededUsd: fee,
    timeToEffectMonths: Math.round(monthsActive),
    scoreImpact: 'high',
    whyThis: [
      `Transferring about ${usd.format(amountToTransfer)} at 0% saves interest immediately.`,
      `We assumed a 3% transfer fee (${usd.format(fee)}).`,
      `Success odds roughly ${Math.round(probability * 100)}% given your utilization.`
    ]
  };

  return {
    id: 'action-balance-transfer',
    type: 'balance_transfer',
    title: 'Move balances to a 0% promo card',
    summary: 'Shift high-interest balances to a 0% offer for ~3 months of runway.',
    estimatedSavingsUsd: savings,
    probabilityOfSuccess: Number(probability.toFixed(3)),
    scenarioRange: { low: roundCurrency(low), high: roundCurrency(high) },
    nextSteps: [
      'Compare balance transfer offers with $0 intro APR.',
      'Confirm the transfer fee and promo length before applying.',
      'Schedule payoff reminders before the promo expires.'
    ],
    tags: ['balance-transfer'],
    metadata
  };
};

const LATE_FEE_REFUND_PROB: Record<ScoreBand, number> = {
  excellent: 0.85,
  very_good: 0.78,
  good: 0.65,
  fair: 0.45,
  poor: 0.32,
  unknown: 0.5
};

const buildLateFeeAction = (
  scoreBand: ScoreBand,
  any60dLate: boolean
): Action | null => {
  const feeAmount = 40;
  const base = LATE_FEE_REFUND_PROB[scoreBand] ?? LATE_FEE_REFUND_PROB.unknown;
  const probability = any60dLate ? base * 0.6 : base;
  const savings = roundCurrency(evLateFee(probability, feeAmount));

  if (savings <= 0) {
    return null;
  }

  const computeScenario = (band: ScoreBand) => {
    const baseProb = LATE_FEE_REFUND_PROB[band] ?? LATE_FEE_REFUND_PROB.unknown;
    const adjusted = any60dLate ? baseProb * 0.6 : baseProb;
    return evLateFee(adjusted, feeAmount);
  };
  const [low, high] = scenarioBounds(scoreBand, (band) => roundCurrency(computeScenario(band)));

  const metadata: ActionMetadata = {
    cashNeededUsd: 0,
    timeToEffectMonths: 0.25,
    scoreImpact: 'low',
    whyThis: [
      'Issuers often waive one late fee every 12 months.',
      `Projected refund ${usd.format(savings)} with ~${Math.round(probability * 100)}% odds.`,
      'A successful refund resets penalty clocks for future goodwill credits.'
    ]
  };

  return {
    id: 'action-late-fee',
    type: 'late_fee_reversal',
    title: 'Ask for a late-fee refund',
    summary: 'Call and request a goodwill credit for the most recent late fee.',
    estimatedSavingsUsd: savings,
    probabilityOfSuccess: Number(Math.min(1, probability).toFixed(3)),
    scenarioRange: { low: roundCurrency(low), high: roundCurrency(high) },
    nextSteps: [
      'Call the issuer and cite your history of on-time payments.',
      'Explain the late payment was an exception and request a courtesy credit.',
      'Confirm the refund posts before ending the call.'
    ],
    tags: ['late-fee', 'phone-call'],
    metadata
  };
};

const buildPenaltyAprAction = (
  scoreBand: ScoreBand,
  util: UtilizationBracket,
  balanceTotal: number,
  any60dLate: boolean,
  evHaircut: number
): Action | null => {
  if (balanceTotal <= 0) return null;

  const baselineDelta = DELTA_APR_TABLE[scoreBand] ?? DELTA_APR_TABLE.unknown;
  const deltaApr = Math.max(6, baselineDelta + 4);
  const monthsActive = 1;
  const probability = aprReductionOdds(scoreBand, util, any60dLate) * 0.8;
  const savings = roundCurrency(
    evPenaltyAPR(probability, deltaApr, balanceTotal, monthsActive) * evHaircut
  );
  if (savings <= 0) {
    return null;
  }

  const computeScenario = (band: ScoreBand) => {
    const p = aprReductionOdds(band, util, any60dLate) * 0.8;
    const delta = Math.max(6, (DELTA_APR_TABLE[band] ?? DELTA_APR_TABLE.unknown) + 4);
    return evPenaltyAPR(p, delta, balanceTotal, monthsActive) * evHaircut;
  };
  const [low, high] = scenarioBounds(scoreBand, (band) => roundCurrency(computeScenario(band)));

  const metadata: ActionMetadata = {
    cashNeededUsd: 0,
    timeToEffectMonths: monthsActive,
    scoreImpact: 'medium',
    whyThis: [
      `Penalty APR reversal saves about ${usd.format(savings)} this month.`,
      `Delta APR assumed ${deltaApr.toFixed(1)}%.`,
      `Success odds roughly ${Math.round(probability * 100)}% with quick follow-up.`
    ]
  };

  return {
    id: 'action-penalty-apr',
    type: 'penalty_apr_reduction',
    title: 'Reverse the penalty APR',
    summary: 'Call the issuer, make the minimum payment, and request the original APR.',
    estimatedSavingsUsd: savings,
    probabilityOfSuccess: Number(Math.min(1, probability).toFixed(3)),
    scenarioRange: { low: roundCurrency(low), high: roundCurrency(high) },
    nextSteps: [
      'Bring the account current before calling.',
      'Ask the retention team to restore the pre-penalty APR.',
      'Request written confirmation of the rate change.'
    ],
    tags: ['penalty-apr', 'phone-call'],
    metadata
  };
};

const scoreImpactPriority: Record<ScoreImpact, number> = {
  high: 0,
  medium: 1,
  low: 2
};

const sortActions = (actions: Action[]): Action[] =>
  [...actions].sort((a, b) => {
    if (b.estimatedSavingsUsd !== a.estimatedSavingsUsd) {
      return b.estimatedSavingsUsd - a.estimatedSavingsUsd;
    }
    const impactA = scoreImpactPriority[a.metadata?.scoreImpact ?? 'medium'];
    const impactB = scoreImpactPriority[b.metadata?.scoreImpact ?? 'medium'];
    return impactA - impactB;
  });

export const buildEvPlan = (input: AnalyzeInput): { actions: Action[]; warnings: Warning[] } => {
  const flags: AnalyzeFlags = input.flags ?? {};
  const scoreBand = input.user.scoreBand ?? 'unknown';

  const revolvingAccounts = input.accounts.filter(asRevolving);
  const aggregates = aggregateBalances(revolvingAccounts);

  const utilPercent =
    aggregates.knownLimits > 0
      ? toPercent(aggregates.knownLimitBalance, aggregates.knownLimits)
      : 50;
  let utilization = utilBracket(utilPercent);

  const missingRatio =
    aggregates.totalBalance > 0 ? aggregates.missingLimitBalance / aggregates.totalBalance : 0;
  if (missingRatio > 0.3) {
    utilization = bumpBracket(utilization);
  }

  const evHaircut = missingRatio > 0.3 ? 0.5 : 1;

  const weightedApr =
    aggregates.totalBalance > 0
      ? revolvingAccounts.reduce((sum, account) => {
          const apr = toApr(account, scoreBand);
          return sum + apr * Math.max(0, account.balance);
        }, 0) / aggregates.totalBalance
      : 0;

  const actions: Array<Action | null> = [];

  actions.push(
    buildAprReductionAction(
      scoreBand,
      utilization,
      aggregates.totalBalance,
      Boolean(flags.any60dLate),
      evHaircut
    )
  );

  actions.push(
    buildBalanceTransferAction(
      scoreBand,
      utilization,
      aggregates.totalBalance,
      weightedApr,
      Boolean(flags.any60dLate),
      evHaircut
    )
  );

  if (flags.lateFeeLastTwoStatements) {
    actions.push(buildLateFeeAction(scoreBand, Boolean(flags.any60dLate)));
  }

  if (flags.penaltyAprActive) {
    actions.push(
      buildPenaltyAprAction(
        scoreBand,
        utilization,
        aggregates.totalBalance,
        Boolean(flags.any60dLate),
        evHaircut
      )
    );
  }

  const filtered = sortActions(actions.filter((action): action is Action => Boolean(action)));

  const warnings: Warning[] = [];
  if (aggregates.totalBalance <= 0) {
    warnings.push({
      code: 'no_revolving_balances',
      message: 'No revolving balances detected; action values may be limited.',
      level: 'warning'
    });
  }
  if (missingRatio > 0.3) {
    warnings.push({
      code: 'missing_limits',
      message:
        'More than 30% of balances are missing credit limits. Savings estimates include a 50% haircut.',
      level: 'warning'
    });
  }

  return { actions: filtered, warnings };
};
