import { parseEquifaxText, type ParsedAccount } from './equifax';

export type Bureau = 'equifax' | 'experian' | 'transunion';

export type EquifaxMetrics = {
  coveragePercent: number;
  numericExactPercent: number;
  categoricalDatePercent: number;
};

const EQUFAX_THRESHOLDS = {
  coveragePercent: 70,
  numericExactPercent: 60,
  categoricalDatePercent: 60
} satisfies EquifaxMetrics;

const BETA_THRESHOLDS = {
  coveragePercent: 80,
  numericExactPercent: 95,
  categoricalDatePercent: 95
} satisfies EquifaxMetrics;

const toPercent = (value: number, total: number): number =>
  total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));

const meetsThresholds = (metrics: EquifaxMetrics, thresholds: EquifaxMetrics): boolean =>
  metrics.coveragePercent >= thresholds.coveragePercent &&
  metrics.numericExactPercent >= thresholds.numericExactPercent &&
  metrics.categoricalDatePercent >= thresholds.categoricalDatePercent;

const NUMERIC_CONFIDENCE_THRESHOLD = 0.9;
const CATEGORICAL_CONFIDENCE_THRESHOLD = 0.75;
const DATE_CONFIDENCE_THRESHOLD = 0.75;

const hasConfidentNumber = (
  account: ParsedAccount,
  valueKey: keyof ParsedAccount,
  confidenceKey: keyof ParsedAccount
): boolean => {
  const value = account[valueKey];
  const confidence = account[confidenceKey];
  if (typeof value !== 'number') return false;
  return typeof confidence === 'number' ? confidence >= NUMERIC_CONFIDENCE_THRESHOLD : true;
};

const hasConfidentString = (
  account: ParsedAccount,
  valueKey: keyof ParsedAccount,
  confidenceKey: keyof ParsedAccount,
  threshold: number
): boolean => {
  const value = account[valueKey];
  const confidence = account[confidenceKey];
  if (!value) return false;
  return typeof confidence === 'number' ? confidence >= threshold : true;
};

const hasGateBFields = (account: ParsedAccount): boolean => {
  const hasBalance = hasConfidentNumber(account, 'balance', 'balanceConfidence');
  const hasLimit =
    hasConfidentNumber(account, 'creditLimit', 'creditLimitConfidence') ||
    hasConfidentNumber(account, 'highCredit', 'highCreditConfidence');
  const hasStatus = hasConfidentString(
    account,
    'status',
    'statusConfidence',
    CATEGORICAL_CONFIDENCE_THRESHOLD
  );
  return hasBalance && hasLimit && hasStatus;
};

const needsManualReview = (account: ParsedAccount): boolean => {
  return !hasGateBFields(account);
};

export const computeEquifaxMetrics = (accounts: ParsedAccount[]): EquifaxMetrics => {
  const coverageHits = accounts.filter(hasGateBFields).length;
  const numericFields = [
    ['balance', 'balanceConfidence'],
    ['creditLimit', 'creditLimitConfidence'],
    ['highCredit', 'highCreditConfidence']
  ] as const;
  const numericTotal = accounts.length * numericFields.length;
  const numericExactHits = accounts.reduce((acc, account) => {
    return (
      acc +
      numericFields.reduce((count, [field, confidenceField]) => {
        const value = account[field];
        const confidence = account[confidenceField];
        if (typeof value !== 'number') return count;
        if (typeof confidence === 'number' && confidence < NUMERIC_CONFIDENCE_THRESHOLD) {
          return count;
        }
        return count + 1;
      }, 0)
    );
  }, 0);

  const categoricalFields = [
    ['status', 'statusConfidence', CATEGORICAL_CONFIDENCE_THRESHOLD],
    ['ownership', 'ownershipConfidence', CATEGORICAL_CONFIDENCE_THRESHOLD],
    ['openDate', 'openDateConfidence', DATE_CONFIDENCE_THRESHOLD],
    ['reportedDate', 'reportedDateConfidence', DATE_CONFIDENCE_THRESHOLD]
  ] as const;
  const categoricalTotal = accounts.length * categoricalFields.length;
  const categoricalHits = accounts.reduce((acc, account) => {
    return (
      acc +
      categoricalFields.reduce((count, [field, confidenceField, threshold]) => {
        const value = account[field];
        const confidence = account[confidenceField];
        if (!value) return count;
        if (typeof confidence === 'number' && confidence < threshold) {
          return count;
        }
        return count + 1;
      }, 0)
    );
  }, 0);

  return {
    coveragePercent: toPercent(coverageHits, accounts.length || 1),
    numericExactPercent: toPercent(numericExactHits, numericTotal || 1),
    categoricalDatePercent: toPercent(categoricalHits, categoricalTotal || 1)
  };
};

const bureauThresholds: Record<Bureau, EquifaxMetrics> = {
  equifax: EQUFAX_THRESHOLDS,
  experian: BETA_THRESHOLDS,
  transunion: BETA_THRESHOLDS
};

export const analyzeBureauDocument = (bureau: Bureau, text: string) => {
  const parse = parseEquifaxText(text);
  const metrics = computeEquifaxMetrics(parse.accounts);
  const accountsNeedingReview = parse.accounts.filter(needsManualReview);
  const thresholds = bureauThresholds[bureau] ?? EQUFAX_THRESHOLDS;
  return {
    ...parse,
    metrics,
    requiresManualReview: !meetsThresholds(metrics, thresholds),
    accountsNeedingReview
  };
};

export const analyzeEquifaxDocument = (text: string) => analyzeBureauDocument('equifax', text);
