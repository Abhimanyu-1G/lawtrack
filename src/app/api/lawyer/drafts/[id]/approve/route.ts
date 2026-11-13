import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/lawyer/drafts/:id/approve — terminal approval; unlocks the PDF. */
const approveDraft = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const draft = await getDraftsService().approve(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );
    return jsonResponse({ draft });
  },
  { roles: ['Lawyer'] },
);

export const POST = withApiHandler(approveDraft, { name: 'POST /api/lawyer/drafts/:id/approve' });
