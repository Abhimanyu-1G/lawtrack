import 'server-only';

import { readSessionToken } from '../lib/tokens';
import { unauthorized } from '../lib/errors';
import { readCookie } from './cookies';
import { SESSION_COOKIE, type SessionClaims } from '../../shared/session';

/** Verified session for a request, or `null` when absent/invalid. */
export async function getOptionalSession(request: Request): Promise<SessionClaims | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  return readSessionToken(token);
}

/** Verified session or a 401. */
export async function requireSession(request: Request): Promise<SessionClaims> {
  const session = await getOptionalSession(request);
  if (!session) throw unauthorized();
  return session;
}
