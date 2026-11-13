import { getChatService } from '@/server/modules/chat';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/lawyer/help-requests — chatbot escalations sent to this lawyer. */
const listHelpRequests = withAuth(
  async (_request, session: SessionClaims) => {
    const requests = await getChatService().helpRequests(Number(session.sub));
    return jsonResponse({ requests });
  },
  { roles: ['Lawyer'] },
);

export const GET = withApiHandler(listHelpRequests, { name: 'GET /api/lawyer/help-requests' });
