import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { caseIdFromContext, type CaseRouteContext } from '@/server/http/caseRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/:id/refresh — re-sync one case the citizen already tracks.
 *
 * Exists because the background sync runs every few minutes and a citizen
 * waiting on a hearing needs an on-demand refresh (D-52). Ownership is checked
 * before the adapter is called; a failed refresh returns the stored copy with
 * `stale: true` rather than an error, so the timeline they were reading stays
 * on screen.
 */
const refreshCase = withAuth<CaseRouteContext>(
  async (request, session: SessionClaims, context) => {
    const caseId = await caseIdFromContext(context!);
    const detail = await getCasesService().refreshForCitizen(
      Number(session.sub),
      caseId,
      localeFromRequest(request),
    );
    return jsonResponse({ case: detail });
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(refreshCase, { name: 'POST /api/cases/:id/refresh' });
