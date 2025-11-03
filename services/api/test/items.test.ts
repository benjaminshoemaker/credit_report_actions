import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENGINE_VERSION } from '../src/constants.js';
import { setupTestDb } from './utils/setup-test-db.js';

const enforceUsageCapMock = vi.fn();

class MockUsageCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageCapError';
  }
}

vi.mock('../src/usage/caps.js', () => ({
  enforceUsageCap: enforceUsageCapMock,
  UsageCapError: MockUsageCapError
}));

const buildEvent = (overrides: any = {}) => ({
  headers: {},
  requestContext: {
    http: {
      method: 'POST'
    }
  },
  ...overrides
});

describe('Items handler', () => {
  let handler: typeof import('../src/handlers/items.js')['handler'];
  let itemsStore: ReturnType<typeof setupTestDb>['items'];

  beforeEach(async () => {
    const { items } = setupTestDb();
    itemsStore = items;
    ({ handler } = await import('../src/handlers/items.js'));
    enforceUsageCapMock.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  const createItem = async (overrides: Partial<Record<string, unknown>> = {}) => {
    const payload = {
      user_id: 'user-1',
      type: 'letter',
      template_id: 'tmpl-123',
      payload_no_pii: { foo: 'bar' },
      engine_version: ENGINE_VERSION,
      ...overrides
    };

    const response = await handler(
      buildEvent({
        body: JSON.stringify(payload)
      })
    );

    expect(response.statusCode).toBe(201);
    return JSON.parse(response.body ?? '{}').item_id as string;
  };

  it('creates and retrieves saved items with stale flag', async () => {
    const freshId = await createItem();
    await createItem({ engine_version: 'v0.9.0' });

    const getResponse = await handler(
      buildEvent({
        requestContext: { http: { method: 'GET' } },
        queryStringParameters: { user_id: 'user-1' }
      })
    );

    expect(getResponse.statusCode).toBe(200);
    const body = JSON.parse(getResponse.body ?? '{}');
    expect(body.items).toHaveLength(2);
    const freshItem = body.items.find((item: any) => item.item_id === freshId);
    const staleItem = body.items.find((item: any) => item.engine_version !== ENGINE_VERSION);
    expect(freshItem?.stale).toBe(false);
    expect(staleItem?.stale).toBe(true);
  });

  it('limits payload size', async () => {
    const largePayload = { text: 'x'.repeat(11 * 1024) };
    const response = await handler(
      buildEvent({
        body: JSON.stringify({
          user_id: 'user-1',
          type: 'letter',
          template_id: 'tmpl',
          payload_no_pii: largePayload,
          engine_version: ENGINE_VERSION
        })
      })
    );

    expect(response.statusCode).toBe(413);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error.code).toBe('payload_too_large');
  });

  it('deletes an item', async () => {
    const itemId = await createItem();

    const deleteResponse = await handler(
      buildEvent({
        requestContext: { http: { method: 'DELETE' } },
        pathParameters: { itemId },
        queryStringParameters: { user_id: 'user-1' }
      })
    );

    expect(deleteResponse.statusCode).toBe(204);
    expect(itemsStore).toHaveLength(0);
  });

  it('returns 429 when usage cap exceeded', async () => {
    enforceUsageCapMock.mockRejectedValueOnce(new MockUsageCapError('limit'));
    const response = await handler(
      buildEvent({
        body: JSON.stringify({
          user_id: 'user-1',
          type: 'letter',
          template_id: 'tmpl',
          payload_no_pii: {},
          engine_version: ENGINE_VERSION
        })
      })
    );

    expect(response.statusCode).toBe(429);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error.code).toBe('usage_cap_exceeded');
  });
});
