import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

export const handler = async (): Promise<APIGatewayProxyStructuredResultV2> => ({
  statusCode: 200,
  body: JSON.stringify({ status: 'ok' })
});
