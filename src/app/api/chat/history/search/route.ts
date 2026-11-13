import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/chat/history/search?q= — the citizen's own question/answer history. */
const searchHistory = withAuth(
  async (request, session: SessionClaims) => {
    const url = new URL(request.url);
    const results = await getChatService().searchHistory(
      Number(session.sub),
      url.searchParams.get('q'),
    );
    return jsonResponse({ results });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(searchHistory, { name: 'GET /api/chat/history/search' });
