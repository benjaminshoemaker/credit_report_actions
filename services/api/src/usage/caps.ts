import type { PoolClient } from 'pg';
import { getClient } from '../db.js';
import {
  ANALYZE_DAILY_CAP,
  SCRIPT_DAILY_CAP,
  EXPORT_DAILY_CAP
} from '../constants.js';

export class UsageCapError extends Error {
  readonly kind: UsageKind;
  constructor(kind: UsageKind, message: string) {
    super(message);
    this.name = 'UsageCapError';
    this.kind = kind;
  }
}

type UsageKind = 'analysis' | 'script' | 'export';

const CAP_LOOKUP: Record<UsageKind, number> = {
  analysis: ANALYZE_DAILY_CAP,
  script: SCRIPT_DAILY_CAP,
  export: EXPORT_DAILY_CAP
};

const COLUMN_LOOKUP: Record<UsageKind, { column: string }> = {
  analysis: { column: 'analyses_used' },
  script: { column: 'scripts_used' },
  export: { column: 'exports_used' }
};

const getToday = (): string => {
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const incrementUsage = async (
  client: PoolClient,
  userId: string,
  kind: UsageKind
): Promise<void> => {
  const { column } = COLUMN_LOOKUP[kind];
  const today = getToday();
  await client.query(
    `
    INSERT INTO usage_caps (user_id, usage_date, ${column})
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET ${column} = usage_caps.${column} + 1
    `,
    [userId, today]
  );
};

const readUsage = async (
  client: PoolClient,
  userId: string,
  kind: UsageKind
): Promise<number> => {
  const { column } = COLUMN_LOOKUP[kind];
  const today = getToday();
  const { rows } = await client.query(
    `SELECT ${column} AS value FROM usage_caps WHERE user_id = $1 AND usage_date = $2`,
    [userId, today]
  );
  return Number(rows[0]?.value ?? 0);
};

export const enforceUsageCap = async (userId: string, kind: UsageKind): Promise<void> => {
  const cap = CAP_LOOKUP[kind];
  if (cap <= 0) {
    return;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const current = await readUsage(client, userId, kind);
    if (current >= cap) {
      throw new UsageCapError(
        kind,
        `Daily ${kind} limit reached. Try again tomorrow or contact support.`
      );
    }
    await incrementUsage(client, userId, kind);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

