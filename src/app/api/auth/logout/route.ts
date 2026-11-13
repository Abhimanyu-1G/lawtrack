import { withAuth } from '@/server/http/auth';
import { attachCookies, buildClearedAuthCookies } from '@/server/http/cookies';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — clears both auth cookies. */
const logout = withAuth(async () => {
  return attachCookies(jsonResponse({ ok: true }), buildClearedAuthCookies());
});

export const POST = withApiHandler(logout, { name: 'POST /api/auth/logout' });
