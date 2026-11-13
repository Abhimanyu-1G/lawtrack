import 'server-only';

/**
 * Request correlation id. Clients may send `X-Request-Id`; only a conservative
 * charset is accepted (no header injection), otherwise a UUID is generated.
 * Every API response echoes the id so a user can quote it in a bug report.
 */

export const REQUEST_ID_HEADER = 'x-request-id';
const MAX_LENGTH = 64;
const ALLOWED = /^[A-Za-z0-9._-]+$/;

export function isValidRequestId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_LENGTH && ALLOWED.test(value);
}

export function resolveRequestId(request: Request): string {
  const provided = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (provided && isValidRequestId(provided)) return provided;
  return crypto.randomUUID();
}

export function withRequestIdHeader(response: Response, requestId: string): Response {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
