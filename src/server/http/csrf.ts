import 'server-only';

import { CSRF_COOKIE, CSRF_HEADER } from '../../shared/session';
import { AppError } from '../lib/errors';
import { readCookie } from './cookies';

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

/**
 * Double-submit CSRF check (AGENTS.md §16): the cookie is readable by the app,
 * and an attacker on another origin cannot read it to forge the header.
 */
export function assertCsrf(request: Request): void {
  const cookieToken = readCookie(request, CSRF_COOKIE);
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new AppError(
      'FORBIDDEN',
      'Your session security token is missing or invalid. Refresh the page and try again.',
    );
  }
}
