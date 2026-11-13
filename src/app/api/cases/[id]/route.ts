import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { caseIdFromContext, type CaseRouteContext } from '@/server/http/caseRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cases/:id — one tracked case with its hearings. A citizen who does
 * not follow the case gets `404`, exactly like a case that does not exist.
 */
const getCase = withAuth<CaseRouteContext>(
  async (request, session: SessionClaims, context) => {
    const caseId = await caseIdFromContext(context!);
    const detail = await getCasesService().getForCitizen(
      Number(session.sub),
      caseId,
      localeFromRequest(request),
    );
    return jsonResponse({ case: detail });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(getCase, { name: 'GET /api/cases/:id' });
