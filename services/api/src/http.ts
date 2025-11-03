import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { CSP_POLICY } from './constants.js';

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': '',
  'Content-Security-Policy': CSP_POLICY,
  'Cache-Control': 'no-store'
} as const;

const withSecurityHeaders = (
  headers: Record<string, string> = {}
): Record<string, string> => ({
  ...SECURITY_HEADERS,
  ...headers
});

export const jsonResponse = (
  statusCode: number,
  data: unknown
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: withSecurityHeaders({ 'Content-Type': 'application/json' }),
  body: JSON.stringify(data ?? {})
});

export const emptyResponse = (statusCode: number): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: withSecurityHeaders(),
  body: ''
});

export const errorResponse = (
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyStructuredResultV2 => jsonResponse(statusCode, { error: { code, message } });
