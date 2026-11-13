import 'server-only';

import { randomBytes } from 'node:crypto';

import { CSRF_COOKIE, SESSION_COOKIE } from '../../shared/session';
import { getEnv } from '../config/env';
import { SESSION_TTL_SECONDS } from '../lib/tokens';

/**
 * Cookie serialisation for raw `Response` route handlers (AGENTS.md §16).
 *
 * The session cookie is httpOnly; the CSRF cookie is readable by same-origin
 * JavaScript so the double-submit header can be attached to mutations. Both are
 * `SameSite=Lax`, `Secure` in production, and scoped to the whole site.
 */

/** Read one cookie from the raw `Cookie` header (Node runtime only). */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

function attributes(maxAgeSeconds: number, httpOnly: boolean): string {
  const env = getEnv();
  // A local `next start` preview uses http://localhost; every real deployment
  // uses https, where cookies must be Secure.
  const secure = env.isProduction && env.CLIENT_ORIGIN.startsWith('https://') ? '; Secure' : '';
  return `Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}${secure}`;
}

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function buildAuthCookies(values: { token: string; csrfToken: string }): string[] {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(values.token)}; ${attributes(SESSION_TTL_SECONDS, true)}`,
    `${CSRF_COOKIE}=${encodeURIComponent(values.csrfToken)}; ${attributes(SESSION_TTL_SECONDS, false)}`,
  ];
}

export function buildClearedAuthCookies(): string[] {
  return [`${SESSION_COOKIE}=; ${attributes(0, true)}`, `${CSRF_COOKIE}=; ${attributes(0, false)}`];
}

/** Append `Set-Cookie` values to a response built by `jsonResponse`. */
export function attachCookies(response: Response, cookies: readonly string[]): Response {
  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
  }
  return response;
}
