import { getAuthService } from '@/server/modules/auth';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/auth/me — fresh profile from the database, not just the JWT. */
const me = withAuth(async (_request, session) => {
  const user = await getAuthService().me(Number(session.sub));
  return jsonResponse({ user });
});

export const GET = withApiHandler(me, { name: 'GET /api/auth/me' });
