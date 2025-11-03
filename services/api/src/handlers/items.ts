import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { z } from '@shared-schemas';
import { ensureMigrations, getClient } from '../db.js';
import { ENGINE_VERSION } from '../constants.js';
import { emptyResponse, errorResponse, jsonResponse } from '../http.js';
import { enforceUsageCap, UsageCapError } from '../usage/caps.js';

const MAX_PAYLOAD_BYTES = 10 * 1024;

const ItemPayloadSchema = z.object({
  user_id: z.string().min(1),
  type: z.string().min(1),
  template_id: z.string().min(1),
  payload_no_pii: z.unknown(),
  engine_version: z.string().min(1)
});

type ItemPayload = z.infer<typeof ItemPayloadSchema>;

const parseMethod = (event: APIGatewayProxyEventV2): string =>
  (event.requestContext?.http?.method ?? '').toUpperCase();

const parseJsonBody = <T>(event: APIGatewayProxyEventV2, schema: z.ZodSchema<T>) => {
  if (!event.body) {
    throw new Error('Request body missing');
  }

  const raw = JSON.parse(event.body);
  return schema.parse(raw);
};

const ensurePayloadSize = (payload: unknown) => {
  try {
    const serialized = JSON.stringify(payload);
    const size = Buffer.byteLength(serialized, 'utf8');
    if (size > MAX_PAYLOAD_BYTES) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const resolveUsageKind = (type: string): 'script' | 'export' | null => {
  const normalized = type.toLowerCase();
  if (normalized.includes('script')) return 'script';
  if (normalized.includes('letter') || normalized.includes('pdf') || normalized.includes('export')) {
    return 'export';
  }
  return null;
};

const handlePost = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  let payload: ItemPayload;
  try {
    payload = parseJsonBody(event, ItemPayloadSchema);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    return errorResponse(400, 'invalid_request', message);
  }

  if (!ensurePayloadSize(payload.payload_no_pii)) {
    return errorResponse(413, 'payload_too_large', 'payload_no_pii must be <= 10KB');
  }

  const usageKind = resolveUsageKind(payload.type);
  if (usageKind) {
    try {
      await enforceUsageCap(payload.user_id, usageKind);
    } catch (error) {
      if (error instanceof UsageCapError) {
        return errorResponse(429, 'usage_cap_exceeded', error.message);
      }
      throw error;
    }
  }

  const client = await getClient();
  try {
    const itemId = randomUUID();
    await client.query(
      `INSERT INTO saved_items (
        item_id,
        user_id,
        type,
        template_id,
        payload_no_pii,
        engine_version
      ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        itemId,
        payload.user_id,
        payload.type,
        payload.template_id,
        payload.payload_no_pii,
        payload.engine_version
      ]
    );

    return jsonResponse(201, { item_id: itemId });
  } finally {
    client.release();
  }
};

const handleGet = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const userId = event.queryStringParameters?.user_id;
  if (!userId) {
    return errorResponse(400, 'bad_request', 'user_id is required');
  }

  const client = await getClient();
  try {
    const { rows } = await client.query<{
      item_id: string;
      type: string;
      template_id: string;
      payload_no_pii: unknown;
      engine_version: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT item_id, type, template_id, payload_no_pii, engine_version, created_at, updated_at
       FROM saved_items
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const items = rows.map((row) => ({
      item_id: row.item_id,
      type: row.type,
      template_id: row.template_id,
      payload_no_pii: row.payload_no_pii,
      engine_version: row.engine_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
      stale: row.engine_version !== ENGINE_VERSION
    }));

    return jsonResponse(200, { items });
  } finally {
    client.release();
  }
};

const handleDelete = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  const itemId = event.pathParameters?.itemId ?? event.pathParameters?.itemID ?? null;
  const userId = event.queryStringParameters?.user_id ?? null;

  if (!itemId || !userId) {
    return errorResponse(400, 'bad_request', 'itemId and user_id are required');
  }

  const client = await getClient();
  try {
    await client.query('DELETE FROM saved_items WHERE item_id = $1 AND user_id = $2', [itemId, userId]);
    return emptyResponse(204);
  } finally {
    client.release();
  }
};

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  await ensureMigrations();

  const method = parseMethod(event);
  switch (method) {
    case 'POST':
      return handlePost(event);
    case 'GET':
      return handleGet(event);
    case 'DELETE':
      return handleDelete(event);
    default:
      return errorResponse(405, 'method_not_allowed', `Unsupported method ${method || 'UNKNOWN'}`);
  }
};
