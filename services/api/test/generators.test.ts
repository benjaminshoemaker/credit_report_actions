import { beforeEach, describe, expect, it, vi } from 'vitest';

const callOpenAIMock = vi.fn();

vi.mock('../src/llm/openai.js', () => ({
  callOpenAI: callOpenAIMock
}));

describe('LLM generators', () => {
  beforeEach(() => {
    callOpenAIMock.mockReset();
  });

  it('falls back to static APR reduction script when OpenAI fails', async () => {
    callOpenAIMock.mockRejectedValue(new Error('upstream error'));
    const { generateAprReductionScript } = await import('../src/llm/generators.js');

    const script = await generateAprReductionScript({
      creditor: 'Summit Bank',
      balance: 3200,
      apr: 26.4
    });

    expect(script).toContain('APR Reduction');
    expect(script).toContain('Escalation (50–60s)');
    expect(script).toMatch(/Summit Bank/);
  });

  it('returns OpenAI content when available for late-fee scripts', async () => {
    callOpenAIMock.mockResolvedValue('custom late-fee script');
    const { generateLateFeeScript } = await import('../src/llm/generators.js');

    const script = await generateLateFeeScript({
      creditor: 'Atlas Card',
      feeAmount: 39,
      statementMonth: 'May 2024'
    });

    expect(script).toBe('custom late-fee script');
    expect(callOpenAIMock).toHaveBeenCalled();
  });

  it('uses fallback HTML dispute letter when OpenAI fails', async () => {
    callOpenAIMock.mockRejectedValue(new Error('routing failure'));
    const { generateDisputeLetterTemplate } = await import('../src/llm/generators.js');

    const html = await generateDisputeLetterTemplate({
      bureauName: 'Experian',
      accountName: 'Valor Card',
      disputeReason: 'Balance reporting differs from statement'
    });

    expect(html).toContain('<html');
    expect(html).toContain('{{CONSUMER_NAME}}');
    expect(html).toContain('Exhibit');
  });
});

