import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/drafts/:id — one owned draft. Unapproved text is never returned. */
const getDraft = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const draft = await getDraftsService().getForCitizen(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );
    return jsonResponse({ draft, demo: getDraftsService().demoMode });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(getDraft, { name: 'GET /api/drafts/:id' });
