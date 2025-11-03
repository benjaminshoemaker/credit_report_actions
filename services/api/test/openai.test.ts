import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callOpenAI, OpenAIError } from '../src/llm/openai.js';

const buildResponse = (overrides: Partial<Response> & { json?: () => Promise<any>; text?: () => Promise<string> }) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    text: async () => '',
    ...overrides
  }) as Response;

describe('OpenAI client payload enforcement', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  });

  it('rejects payloads with unsupported root keys before making a request', async () => {
    await expect(
      callOpenAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Hello' }],
        extra: 'nope'
      } as any)
    ).rejects.toThrow(/unsupported root keys/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects payloads with unsupported message keys', async () => {
    await expect(
      callOpenAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Hello', emphasis: 'bold' } as any]
      })
    ).rejects.toThrow(/unsupported keys/i);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends zero-retention headers and returns content on success', async () => {
    (global.fetch as unknown as vi.Mock).mockResolvedValue(
      buildResponse({
        json: async () => ({
          choices: [{ message: { content: 'Generated content' } }]
        })
      })
    );

    const result = await callOpenAI({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: 'Hello' }]
    });

    expect(result).toBe('Generated content');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as unknown as vi.Mock).mock.calls[0];
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'OpenAI-Processing-Options': 'respond-no-retain'
    });
  });

  it('throws OpenAIError with status code when API responds with failure', async () => {
    (global.fetch as unknown as vi.Mock).mockResolvedValue(
      buildResponse({
        ok: false,
        status: 502,
        text: async () => 'upstream error'
      })
    );

    await expect(
      callOpenAI({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Hello' }]
      })
    ).rejects.toMatchObject<OpenAIError>({
      status: 502
    });
  });
});

