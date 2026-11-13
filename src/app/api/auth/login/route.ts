import { ROLE_HOME } from '@/shared/enums';
import { getAuthService } from '@/server/modules/auth';
import { attachCookies, buildAuthCookies, createCsrfToken } from '@/server/http/cookies';
import { clientIpFromRequest } from '@/server/http/clientIp';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import { createSessionToken } from '@/server/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/login — generic failure, throttled per IP + email. */
async function login(request: Request): Promise<Response> {
  requireJsonContentType(request);
  const body = await readJsonBody(request);
  const session = await getAuthService().login(body, {
    ip: clientIpFromRequest(request),
    locale: localeFromRequest(request),
  });

  const token = await createSessionToken(session.claims);
  const csrfToken = createCsrfToken();

  return attachCookies(
    jsonResponse({
      user: session.user,
      redirectTo: ROLE_HOME[session.user.role],
    }),
    buildAuthCookies({ token, csrfToken }),
  );
}

export const POST = withApiHandler(login, { name: 'POST /api/auth/login' });
