import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { caseIdFromContext, type CaseRouteContext } from '@/server/http/caseRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/cases/:id/hearings — the hearing timeline, newest first. */
const getHearings = withAuth<CaseRouteContext>(
  async (_request, session: SessionClaims, context) => {
    const caseId = await caseIdFromContext(context!);
    const hearings = await getCasesService().hearings(Number(session.sub), caseId);
    return jsonResponse({ hearings });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(getHearings, { name: 'GET /api/cases/:id/hearings' });
