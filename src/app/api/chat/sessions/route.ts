import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/chat/sessions — the citizen's own sessions, newest first.
 * POST /api/chat/sessions — start a session (language defaults to the profile).
 */

const listSessions = withAuth(
  async (_request, session: SessionClaims) => {
    const service = getChatService();
    const sessions = await service.listSessions(Number(session.sub));
    return jsonResponse({ sessions, demo: service.demoMode });
  },
  { roles: ['Citizen'] },
);

const createSession = withAuth(
  async (request, session: SessionClaims) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const created = await getChatService().createSession(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ session: created, demo: getChatService().demoMode }, { status: 201 });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(listSessions, { name: 'GET /api/chat/sessions' });
export const POST = withApiHandler(createSession, { name: 'POST /api/chat/sessions' });
