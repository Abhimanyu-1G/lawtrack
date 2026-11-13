import type { SessionClaims } from '@/shared/session';
import { CSRF_COOKIE } from '@/shared/session';
import { getAuthService } from '@/server/modules/auth';
import { withAuth } from '@/server/http/auth';
import { attachCookies, buildAuthCookies, createCsrfToken, readCookie } from '@/server/http/cookies';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import { createSessionToken } from '@/server/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/auth/profile — name, phone and language, refreshed session. */
const updateProfile = withAuth(async (request, session) => {
  requireJsonContentType(request);
  const body = await readJsonBody(request);
  const user = await getAuthService().updateProfile(Number(session.sub), body, localeFromRequest(request));

  const claims: SessionClaims = {
    sub: String(user.id),
    role: user.role,
    email: user.email,
    name: user.name,
    language: user.language,
  };
  const token = await createSessionToken(claims);
  // Reuse the existing CSRF token so other open tabs keep working.
  const csrfToken = readCookie(request, CSRF_COOKIE) ?? createCsrfToken();

  return attachCookies(jsonResponse({ user }), buildAuthCookies({ token, csrfToken }));
});

export const PATCH = withApiHandler(updateProfile, { name: 'PATCH /api/auth/profile' });
