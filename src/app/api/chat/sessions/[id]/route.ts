import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { chatSessionIdFromContext, type ChatSessionRouteContext } from '@/server/http/chatRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/chat/sessions/:id — one owned session with its messages and sources. */
const getSession = withAuth<ChatSessionRouteContext>(
  async (request, session: SessionClaims, context) => {
    const sessionId = await chatSessionIdFromContext(context!);
    const detail = await getChatService().getSession(
      Number(session.sub),
      sessionId,
      localeFromRequest(request),
    );
    return jsonResponse({ session: detail, demo: getChatService().demoMode });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(getSession, { name: 'GET /api/chat/sessions/:id' });
