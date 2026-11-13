import { getAuthService } from '@/server/modules/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/register — public sign-up creates a citizen only. */
async function register(request: Request): Promise<Response> {
  requireJsonContentType(request);
  const body = await readJsonBody(request);
  const account = await getAuthService().register(body, localeFromRequest(request));

  return jsonResponse(
    {
      user: account.user,
      delivery: account.delivery,
      next: `/verify-otp?email=${encodeURIComponent(account.user.email)}`,
    },
    { status: 201 },
  );
}

export const POST = withApiHandler(register, { name: 'POST /api/auth/register' });
