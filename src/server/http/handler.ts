import 'server-only';

import { logger } from '../lib/logger';
import { AppError, isExpectedClientError, toErrorBody } from '../lib/errors';
import { assertSameOrigin, isMutatingMethod } from './origin';
import { resolveRequestId, withRequestIdHeader, REQUEST_ID_HEADER } from './requestId';

/**
 * Thin wrapper around every route handler (AGENTS.md §7):
 * resolves a request id, times the call, adds `X-Request-Id`, emits one
 * structured log line and funnels every thrown error through the central
 * error mapper. Route handlers themselves only parse, authorize, delegate and
 * shape JSON.
 */

export type RouteHandler<Context = unknown> = (
  request: Request,
  context?: Context,
) => Promise<Response> | Response;

export interface ApiHandlerOptions {
  /** Stable route label for logs, e.g. "GET /api/health". */
  name?: string;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const;

export function jsonResponse(
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

export function withApiHandler<Context = unknown>(
  handler: RouteHandler<Context>,
  options: ApiHandlerOptions = {},
): RouteHandler<Context> {
  return async (request: Request, context?: Context): Promise<Response> => {
    const requestId = resolveRequestId(request);
    const path = new URL(request.url).pathname;
    const route = options.name ?? `${request.method} ${path}`;
    const log = logger.child({ requestId, route, method: request.method, path });
    const startedAt = Date.now();

    try {
      if (isMutatingMethod(request.method)) assertSameOrigin(request);
      const response = await handler(request, context);
      withRequestIdHeader(response, requestId);
      log.info({ status: response.status, durationMs: Date.now() - startedAt }, 'request completed');
      return response;
    } catch (error) {
      const { status, body } = toErrorBody(error, requestId);

      if (isExpectedClientError(error)) {
        log.warn({ status, code: body.error.code, durationMs: Date.now() - startedAt }, 'request rejected');
      } else {
        log.error({ status, err: error, durationMs: Date.now() - startedAt }, 'request failed');
      }

      return new Response(JSON.stringify(body), {
        status,
        headers: { ...JSON_HEADERS, [REQUEST_ID_HEADER]: requestId },
      });
    }
  };
}

/** Small helpers used by handlers to reject malformed requests early. */
export function requireJsonContentType(request: Request): void {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Send this request as JSON');
  }
}

export const MAX_JSON_BODY_BYTES = 100_000;

/**
 * Parse a JSON body with a size cap. Empty bodies become `{}` so optional
 * payloads work; malformed JSON is a validation error, never a 500.
 */
export async function readJsonBody(request: Request, maxBytes = MAX_JSON_BODY_BYTES): Promise<unknown> {
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > maxBytes) {
    throw new AppError('PAYLOAD_TOO_LARGE', 'That request is too large');
  }
  if (text.trim() === '') return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Send a valid JSON body');
  }
}
