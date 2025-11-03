import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import { randomUUID } from 'node:crypto';
import { z } from '@shared-schemas';
import { ensureMigrations, getClient } from '../db.js';
import { errorResponse, jsonResponse } from '../http.js';

const EventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('consent'),
    user_id: z.string().min(1),
    action_type: z.string().min(1),
    disclosure_version: z.string().min(1),
    scoped_fields_snapshot: z.record(z.unknown()).optional()
  }),
  z.object({
    type: z.literal('outcome'),
    user_id: z.string().min(1),
    action_type: z.string().min(1),
    success: z.boolean(),
    amount_saved_usd: z.number().nonnegative().optional(),
    notes: z.string().max(2000).optional()
  })
]);

type EventInput = z.infer<typeof EventSchema>;

const truncateIp = (ip: string | null | undefined): string | null => {
  if (!ip) {
    return null;
  }

  if (ip.includes(':')) {
    const segments = ip.split(':').filter(Boolean);
    return segments.slice(0, 4).join(':') || null;
  }

  const octets = ip.split('.');
  if (octets.length === 4) {
    return octets.slice(0, 3).join('.');
  }

  return ip;
};

const extractIp = (event: APIGatewayProxyEventV2): string | null => {
  const forwarded = event.headers?.['x-forwarded-for'] ?? event.headers?.['X-Forwarded-For'];
  const candidate = forwarded?.split(',')[0]?.trim() || event.requestContext?.http?.sourceIp;
  return truncateIp(candidate ?? null);
};

const extractUserAgent = (event: APIGatewayProxyEventV2): string | null =>
  event.requestContext?.http?.userAgent ?? event.headers?.['user-agent'] ?? event.headers?.['User-Agent'] ?? null;

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  await ensureMigrations();

  if (!event.body) {
    return errorResponse(400, 'bad_request', 'Request body missing');
  }

  let payload: EventInput;
  try {
    payload = EventSchema.parse(JSON.parse(event.body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    return errorResponse(400, 'invalid_request', message);
  }

  const client = await getClient();
  try {
    const eventId = randomUUID();
    const ipTrunc = extractIp(event);
    const userAgent = extractUserAgent(event);

    const { rows } = await client.query(
      `INSERT INTO events (
        event_id,
        user_id,
        type,
        action_type,
        disclosure_version,
        scoped_fields_snapshot,
        success,
        amount_saved_usd,
        notes,
        ip_trunc,
        user_agent
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING event_id, created_at`,
      [
        eventId,
        payload.user_id,
        payload.type,
        payload.action_type,
        payload.type === 'consent' ? payload.disclosure_version : null,
        'scoped_fields_snapshot' in payload ? payload.scoped_fields_snapshot ?? null : null,
        payload.type === 'outcome' ? payload.success : null,
        payload.type === 'outcome' ? payload.amount_saved_usd ?? null : null,
        payload.type === 'outcome' ? payload.notes ?? null : null,
        ipTrunc,
        userAgent
      ]
    );

    const [row] = rows;
    return jsonResponse(201, {
      event_id: row.event_id,
      created_at: row.created_at
    });
  } finally {
    client.release();
  }
};
