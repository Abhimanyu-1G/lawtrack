import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/lawyer/queue — the shared review queue, oldest first. */
const getQueue = withAuth(
  async (_request, session: SessionClaims) => {
    const queue = await getDraftsService().queue(Number(session.sub));
    return jsonResponse({ queue });
  },
  { roles: ['Lawyer'] },
);

export const GET = withApiHandler(getQueue, { name: 'GET /api/lawyer/queue' });
