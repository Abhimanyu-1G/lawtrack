import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { chatSessionIdFromContext, type ChatSessionRouteContext } from '@/server/http/chatRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/chat/sessions/:id/end — close a session; it stays readable. */
const endSession = withAuth<ChatSessionRouteContext>(
  async (request, session: SessionClaims, context) => {
    const sessionId = await chatSessionIdFromContext(context!);
    const ended = await getChatService().endSession(
      Number(session.sub),
      sessionId,
      localeFromRequest(request),
    );
    return jsonResponse({ session: ended });
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(endSession, { name: 'POST /api/chat/sessions/:id/end' });
