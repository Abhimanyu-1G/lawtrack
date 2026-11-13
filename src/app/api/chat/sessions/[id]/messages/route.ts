import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { chatSessionIdFromContext, type ChatSessionRouteContext } from '@/server/http/chatRoute';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import { chatMessageRateLimiter } from '@/server/http/rateLimit';
import { AppError } from '@/server/lib/errors';
import { getDictionary } from '@/i18n';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/sessions/:id/messages — ask one question. Throttled to
 * 20 messages per minute per citizen (AGENTS.md §8).
 */
const askQuestion = withAuth<ChatSessionRouteContext>(
  async (request, session: SessionClaims, context) => {
    requireJsonContentType(request);
    const locale = localeFromRequest(request);

    const decision = chatMessageRateLimiter.check(`chat:${session.sub}`);
    if (!decision.allowed) {
      throw new AppError('RATE_LIMITED', getDictionary(locale).chat.rateLimited);
    }

    const sessionId = await chatSessionIdFromContext(context!);
    const body = await readJsonBody(request);
    const result = await getChatService().ask(
      Number(session.sub),
      sessionId,
      body,
      locale,
    );

    return jsonResponse(result, { status: 201 });
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(askQuestion, { name: 'POST /api/chat/sessions/:id/messages' });
