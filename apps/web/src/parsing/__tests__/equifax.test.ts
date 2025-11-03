import { describe, expect, it } from 'vitest';
import { parseEquifaxText } from '../equifax';
import { analyzeEquifaxDocument, analyzeBureauDocument, computeEquifaxMetrics } from '../analysis';
import passFixture from '../../../test-fixtures/equifax-pass.txt?raw';
import lowCoverageFixture from '../../../test-fixtures/equifax-low-coverage.txt?raw';
import betaPassFixture from '../../../test-fixtures/experian-beta-pass.txt?raw';
import betaFailFixture from '../../../test-fixtures/transunion-beta-fail.txt?raw';

describe('parseEquifaxText', () => {
  it('extracts revolving accounts with normalized fields', () => {
    const result = parseEquifaxText(passFixture);
    expect(result.accounts).toHaveLength(2);

    const [first, second] = result.accounts;
    expect(first.name).toBe('Chase Freedom');
    expect(first.balance).toBe(2450);
    expect(first.creditLimit).toBe(5000);
    expect(first.highCredit).toBe(5200);
    expect(first.openDate).toBe('2019-04');
    expect(first.reportedDate).toBe('2024-01');
    expect(first.status).toBe('open');
    expect(first.ownership).toBe('individual');
    expect(first.balanceConfidence).toBeGreaterThan(0.8);

    expect(second.name).toBe('Citi Custom Cash');
    expect(second.balance).toBe(1200);
    expect(second.creditLimit).toBe(4500);
    expect(second.openDate).toBe('2020-05');
    expect(second.reportedDate).toBe('2024-01');
    expect(second.status).toBe('current');
    expect(second.ownership).toBe('joint');
  });

  it('parses inquiries with confidence values', () => {
    const result = parseEquifaxText(passFixture);
    expect(result.inquiries).toHaveLength(2);
    const [first] = result.inquiries;
    expect(first.creditor).toBe('Capital One Bank');
    expect(first.date).toBe('2024-02');
    expect(first.dateConfidence).toBeGreaterThan(0.7);
  });

  it('computes metrics and determines review requirement', () => {
    const parsed = parseEquifaxText(passFixture);
    const metrics = computeEquifaxMetrics(parsed.accounts);
    expect(metrics.coveragePercent).toBeGreaterThan(70);
    expect(metrics.numericExactPercent).toBeGreaterThan(80);
    expect(metrics.categoricalDatePercent).toBeGreaterThan(70);
    const evaluation = analyzeEquifaxDocument(passFixture);
    expect(evaluation.requiresManualReview).toBe(false);
  });
});

describe('analyzeEquifaxDocument thresholds', () => {
  it('flags manual review when coverage fails', () => {
    const evaluation = analyzeEquifaxDocument(lowCoverageFixture);
    expect(evaluation.requiresManualReview).toBe(true);
    expect(evaluation.accountsNeedingReview.length).toBeGreaterThan(0);
  });

  it('applies beta thresholds for Experian', () => {
    const evaluation = analyzeBureauDocument('experian', betaPassFixture);
    expect(evaluation.requiresManualReview).toBe(false);
  });

  it('requires manual review when beta thresholds fail', () => {
    const evaluation = analyzeBureauDocument('transunion', betaFailFixture);
    expect(evaluation.requiresManualReview).toBe(true);
  });
});
