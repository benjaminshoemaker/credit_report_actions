import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2
} from 'aws-lambda';
import { AnalyzeInputSchema } from '@shared-schemas';
import { ensureMigrations } from '../db.js';
import { ENGINE_VERSION } from '../constants.js';
import { errorResponse, jsonResponse } from '../http.js';
import { buildEvPlan } from '../analysis/ev.js';
import { enforceUsageCap, UsageCapError } from '../usage/caps.js';

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  await ensureMigrations();

  const startedAt = performance.now();

  if (!event.body) {
    return errorResponse(400, 'bad_request', 'Request body missing');
  }

  try {
    const parsed = AnalyzeInputSchema.parse(JSON.parse(event.body));

    try {
      await enforceUsageCap(parsed.user.id, 'analysis');
    } catch (error) {
      if (error instanceof UsageCapError) {
        return errorResponse(429, 'usage_cap_exceeded', error.message);
      }
      throw error;
    }
    const { actions, warnings } = buildEvPlan(parsed);

    const computeMs = Math.round(performance.now() - startedAt);

    return jsonResponse(200, {
      warnings,
      actions,
      audit: {
        engineVersion: ENGINE_VERSION,
        computeMs
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    return errorResponse(400, 'invalid_request', message);
  }
};
