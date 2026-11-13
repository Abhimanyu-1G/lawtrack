import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { chatSessionIdFromContext, type ChatSessionRouteContext } from '@/server/http/chatRoute';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/chat/sessions/:id/rating — post-session CSAT, 1–5. */
const rateSession = withAuth<ChatSessionRouteContext>(
  async (request, session: SessionClaims, context) => {
    requireJsonContentType(request);
    const sessionId = await chatSessionIdFromContext(context!);
    const body = await readJsonBody(request);
    const result = await getChatService().rateSession(
      Number(session.sub),
      sessionId,
      body,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(rateSession, { name: 'POST /api/chat/sessions/:id/rating' });
