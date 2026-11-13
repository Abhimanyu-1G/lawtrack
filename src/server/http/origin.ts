import 'server-only';

import { getEnv } from '../config/env';
import { AppError } from '../lib/errors';

/** State-changing methods checked for a trusted `Origin` (AGENTS.md §16). */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

function normalizeOrigin(originStr: string): string {
  try {
    return new URL(originStr).origin;
  } catch {
    return originStr;
  }
}

/**
 * Reject cross-site state changes. Browsers send `Origin` on POST/PATCH/etc.;
 * a request without one is a non-browser client (tests, curl, server-to-server)
 * and is allowed through. A mismatched origin is always rejected.
 */
export function assertSameOrigin(request: Request): void {
  if (!isMutatingMethod(request.method)) return;

  const origin = request.headers.get('origin');
  if (!origin) return;

  const env = getEnv();
  const expected = normalizeOrigin(env.CLIENT_ORIGIN);
  const normalizedOrigin = normalizeOrigin(origin);

  if (normalizedOrigin === expected) return;

  // In non-production environments (development / test / E2E), allow loopback equivalents (localhost <-> 127.0.0.1)
  if (!env.isProduction) {
    try {
      const oUrl = new URL(normalizedOrigin);
      const eUrl = new URL(expected);
      const isLoopbackHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
      if (isLoopbackHost(oUrl.hostname) && isLoopbackHost(eUrl.hostname)) {
        if (oUrl.port === eUrl.port || Number(oUrl.port) === env.PORT) {
          return;
        }
      }
    } catch {
      // Fall through to rejection
    }
  }

  throw new AppError('FORBIDDEN_ORIGIN', 'This request came from an untrusted origin');
}
