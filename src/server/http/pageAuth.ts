import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROLE_HOME, type UserRole } from '../../shared/enums';
import { SESSION_COOKIE, type SessionClaims } from '../../shared/session';
import { readSessionToken } from '../lib/tokens';

/**
 * Authoritative page-level authorisation (AGENTS.md §2, §16).
 *
 * `middleware.ts` is only a fast redirect: it cannot reach the database and a
 * stale token claim could still point at the wrong area. Every role layout calls
 * `requirePageRole` so the server re-checks the signed session before rendering.
 */

export async function getPageSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

function loginRedirect(nextPath: string): never {
  redirect(`/login?next=${encodeURIComponent(nextPath)}`);
}

/** Signed-in session, or a redirect to the login page. */
export async function requirePageSession(nextPath: string): Promise<SessionClaims> {
  const session = await getPageSession();
  if (!session) loginRedirect(nextPath);
  return session;
}

/** Signed-in session with the expected role, or a login/forbidden redirect. */
export async function requirePageRole(
  role: UserRole | readonly UserRole[],
  nextPath: string,
): Promise<SessionClaims> {
  const session = await requirePageSession(nextPath);
  const allowed: readonly UserRole[] = typeof role === 'string' ? [role] : role;

  if (!allowed.includes(session.role)) {
    redirect('/forbidden');
  }

  return session;
}

/** Signed-in visitors should never see the public login/register screens. */
export async function redirectIfSignedIn(): Promise<void> {
  const session = await getPageSession();
  if (session) redirect(ROLE_HOME[session.role]);
}
