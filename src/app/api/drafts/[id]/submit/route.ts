import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/drafts/:id/submit — idempotent submit-for-review. The draft is
 * created in `Pending Review`, so this exists to retry a failed fan-out.
 */
const submitDraft = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const draft = await getDraftsService().submitForReview(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );
    return jsonResponse({ draft });
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(submitDraft, { name: 'POST /api/drafts/:id/submit' });
