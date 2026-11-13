import 'server-only';

import { getEnv } from '../config/env';
import { AppError } from '../lib/errors';

/** State-changing methods checked for a trusted `Origin` (AGENTS.md §16). */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
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

  let expected: string;
  try {
    expected = new URL(getEnv().CLIENT_ORIGIN).origin;
  } catch {
    expected = getEnv().CLIENT_ORIGIN;
  }

  if (origin !== expected) {
    throw new AppError('FORBIDDEN_ORIGIN', 'This request came from an untrusted origin');
  }
}
