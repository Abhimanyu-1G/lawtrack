import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/drafts/:id/regenerate — retry a rejection after an AI outage.
 * Rejection normally regenerates automatically; this is the manual fallback
 * and requires the draft to be `Rejected`.
 */
const regenerateDraft = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const draft = await getDraftsService().regenerate(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );
    return jsonResponse({ draft });
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(regenerateDraft, { name: 'POST /api/drafts/:id/regenerate' });
