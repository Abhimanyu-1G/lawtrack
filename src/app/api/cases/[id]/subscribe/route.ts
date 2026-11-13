import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { caseIdFromContext, type CaseRouteContext } from '@/server/http/caseRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST   /api/cases/:id/subscribe — follow a case (idempotent).
 * DELETE /api/cases/:id/subscribe — stop following it.
 *
 * The first CNR lookup already subscribes the citizen (AGENTS.md §6); these
 * handlers let the tracker toggle it afterwards.
 */
const subscribe = withAuth<CaseRouteContext>(
  async (_request, session: SessionClaims, context) => {
    const caseId = await caseIdFromContext(context!);
    const result = await getCasesService().subscribe(Number(session.sub), caseId);
    return jsonResponse(result);
  },
  { roles: ['Citizen'] },
);

const unsubscribe = withAuth<CaseRouteContext>(
  async (_request, session: SessionClaims, context) => {
    const caseId = await caseIdFromContext(context!);
    const result = await getCasesService().unsubscribe(Number(session.sub), caseId);
    return jsonResponse(result);
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(subscribe, { name: 'POST /api/cases/:id/subscribe' });
export const DELETE = withApiHandler(unsubscribe, { name: 'DELETE /api/cases/:id/subscribe' });
