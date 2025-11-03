import { vi } from 'vitest';

export type EventRecord = {
  event_id: string;
  user_id: string;
  type: 'consent' | 'outcome';
  action_type: string | null;
  disclosure_version: string | null;
  scoped_fields_snapshot: unknown;
  success: boolean | null;
  amount_saved_usd: number | null;
  notes: string | null;
  ip_trunc: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ItemRecord = {
  item_id: string;
  user_id: string;
  type: string;
  template_id: string;
  payload_no_pii: unknown;
  engine_version: string;
  created_at: string;
  updated_at: string;
};

const isInsertEvents = (sql: string) => /insert\s+into\s+events/i.test(sql);
const isInsertItems = (sql: string) => /insert\s+into\s+saved_items/i.test(sql);
const isSelectItems = (sql: string) => /select[\s\S]*from\s+saved_items/i.test(sql);
const isDeleteItems = (sql: string) => /delete\s+from\s+saved_items/i.test(sql);

export const setupTestDb = () => {
  vi.resetModules();

  const events: EventRecord[] = [];
  const items: ItemRecord[] = [];

  const createClient = () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (isInsertEvents(sql)) {
        const [eventId, userId, type, actionType, disclosureVersion, snapshot, success, amountSaved, notes, ipTrunc, userAgent] = params as [
          string,
          string,
          EventRecord['type'],
          string | null,
          string | null,
          unknown,
          boolean | null,
          number | null,
          string | null,
          string | null,
          string | null
        ];
        const createdAt = new Date().toISOString();
        const record: EventRecord = {
          event_id: eventId,
          user_id: userId,
          type,
          action_type: actionType,
          disclosure_version: disclosureVersion,
          scoped_fields_snapshot: snapshot ?? null,
          success: success ?? null,
          amount_saved_usd: amountSaved ?? null,
          notes: notes ?? null,
          ip_trunc: ipTrunc ?? null,
          user_agent: userAgent ?? null,
          created_at: createdAt
        };
        events.push(record);
        return { rows: [{ event_id: eventId, created_at: createdAt }], rowCount: 1 };
      }

      if (isInsertItems(sql)) {
        const [itemId, userId, type, templateId, payload, engineVersion] = params as [
          string,
          string,
          string,
          string,
          unknown,
          string
        ];
        const createdAt = new Date().toISOString();
        const record: ItemRecord = {
          item_id: itemId,
          user_id: userId,
          type,
          template_id: templateId,
          payload_no_pii: payload,
          engine_version: engineVersion,
          created_at: createdAt,
          updated_at: createdAt
        };
        items.push(record);
        return { rows: [], rowCount: 1 };
      }

      if (isSelectItems(sql)) {
        const [userId] = params as [string];
        const rows = items
          .filter((item) => item.user_id === userId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .map((item) => ({ ...item }));
        return { rows, rowCount: rows.length };
      }

      if (isDeleteItems(sql)) {
        const [itemId, userId] = params as [string, string];
        const initialLength = items.length;
        const remaining = items.filter((item) => !(item.item_id === itemId && item.user_id === userId));
        items.splice(0, items.length, ...remaining);
        return { rows: [], rowCount: initialLength - items.length };
      }

      return { rows: [], rowCount: 0 };
    },
    release: async () => {}
  });

  const mockModule: any = {
    ensureMigrations: vi.fn().mockResolvedValue(undefined),
    runMigrations: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockImplementation(async () => createClient()),
    closePool: vi.fn().mockResolvedValue(undefined)
  };

  vi.doMock('../../src/db.js', () => mockModule);

  return {
    events,
    items,
    mockModule
  };
};
