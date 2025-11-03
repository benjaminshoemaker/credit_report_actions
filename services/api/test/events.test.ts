import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDb } from './utils/setup-test-db.js';

const baseEvent = {
  headers: {},
  requestContext: {
    http: {
      method: 'POST',
      sourceIp: '203.0.113.24',
      userAgent: 'Vitest'
    }
  }
} as any;

describe('POST /events handler', () => {
  let handler: typeof import('../src/handlers/events.js')['handler'];
  let eventsStore: ReturnType<typeof setupTestDb>['events'];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores consent events with truncated IP and user agent', async () => {
    const { events } = setupTestDb();
    eventsStore = events;
    ({ handler } = await import('../src/handlers/events.js'));

    const response = await handler({
      ...baseEvent,
      body: JSON.stringify({
        type: 'consent',
        user_id: 'user-123',
        action_type: 'apr_reduction',
        disclosure_version: '1.0',
        scoped_fields_snapshot: { score_band: 'good' }
      })
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.event_id).toBeDefined();

    expect(eventsStore).toHaveLength(1);
    expect(eventsStore[0].user_id).toBe('user-123');
    expect(eventsStore[0].ip_trunc).toBe('203.0.113');
    expect(eventsStore[0].user_agent).toBe('Vitest');
    expect(eventsStore[0].disclosure_version).toBe('1.0');
  });

  it('rejects invalid payloads', async () => {
    const { events } = setupTestDb();
    eventsStore = events;
    ({ handler } = await import('../src/handlers/events.js'));

    const response = await handler({
      ...baseEvent,
      body: JSON.stringify({ type: 'consent', user_id: 'user-123' })
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body ?? '{}');
    expect(body.error.code).toBe('invalid_request');
  });
});
