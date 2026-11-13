import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/lawyer/drafts/:id — answers, generated text and earlier reviews for
 * a lawyer. Opening the draft claims it for 15 minutes.
 */
const getDraftForReview = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const draft = await getDraftsService().getForReview(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );
    return jsonResponse({ draft });
  },
  { roles: ['Lawyer'] },
);

export const GET = withApiHandler(getDraftForReview, { name: 'GET /api/lawyer/drafts/:id' });
