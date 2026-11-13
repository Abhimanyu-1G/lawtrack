import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { chatSessionIdFromContext, type ChatSessionRouteContext } from '@/server/http/chatRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/sessions/:id/escalate — "Ask a lawyer". Sends one In-App
 * notification to every Available lawyer and is idempotent per session.
 */
const escalate = withAuth<ChatSessionRouteContext>(
  async (request, session: SessionClaims, context) => {
    const sessionId = await chatSessionIdFromContext(context!);
    const result = await getChatService().escalate(
      Number(session.sub),
      sessionId,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(escalate, { name: 'POST /api/chat/sessions/:id/escalate' });
