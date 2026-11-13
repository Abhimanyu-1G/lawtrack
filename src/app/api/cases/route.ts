import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/cases — the citizen's tracked cases (AGENTS.md §6, §7). */
const listCases = withAuth(
  async (_request, session: SessionClaims) => {
    const cases = await getCasesService().listForCitizen(Number(session.sub));
    return jsonResponse({ cases });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(listCases, { name: 'GET /api/cases' });
