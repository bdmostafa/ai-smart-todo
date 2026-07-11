/**
 * API key authorization middleware.
 *
 * Validates the presence and correctness of the x-api-key header
 * against the AUTHORIZED_API_KEY environment variable.
 *
 * Requirements: 8.3, 8.4
 */

import { ApiGatewayResponse } from './types';

const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-user-id',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

/**
 * Validates the API key from the request headers.
 *
 * Checks that the `x-api-key` header is present and matches
 * the value of the AUTHORIZED_API_KEY environment variable.
 *
 * @param headers - The request headers (case-insensitive lookup recommended)
 * @returns null if the API key is valid (proceed with request),
 *          or an ApiGatewayResponse with 401 status if invalid/missing
 */
export function validateApiKey(
  headers: Record<string, string | undefined>
): ApiGatewayResponse | null {
  const authorizedKey = process.env.AUTHORIZED_API_KEY;

  // Get the API key from headers (case-insensitive lookup)
  const apiKey = getHeaderValue(headers, 'x-api-key');

  if (!apiKey) {
    return buildUnauthorizedResponse('Missing API key. Provide a valid x-api-key header.');
  }

  if (!authorizedKey || apiKey !== authorizedKey) {
    return buildUnauthorizedResponse('Invalid API key.');
  }

  // Valid key — allow request to proceed
  return null;
}

/**
 * Case-insensitive header value lookup.
 * HTTP headers are case-insensitive per RFC 7230.
 */
function getHeaderValue(
  headers: Record<string, string | undefined>,
  headerName: string
): string | undefined {
  const lowerName = headerName.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) {
      return headers[key];
    }
  }
  return undefined;
}

/**
 * Builds a 401 Unauthorized response with the standard ErrorResponse body.
 */
function buildUnauthorizedResponse(message: string): ApiGatewayResponse {
  return {
    statusCode: 401,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    }),
  };
}
