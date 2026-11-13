import { ROLE_HOME } from '@/shared/enums';
import { getAuthService } from '@/server/modules/auth';
import { attachCookies, buildAuthCookies, createCsrfToken } from '@/server/http/cookies';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import { createSessionToken } from '@/server/lib/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/verify-otp — sets `is_verified` and signs the user in. */
async function verifyOtp(request: Request): Promise<Response> {
  requireJsonContentType(request);
  const body = await readJsonBody(request);
  const session = await getAuthService().verifyOtp(body, localeFromRequest(request));

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

export const POST = withApiHandler(verifyOtp, { name: 'POST /api/auth/verify-otp' });
