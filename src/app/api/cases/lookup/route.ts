import { getCasesService } from '@/server/modules/cases';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/lookup — resolve a CNR through eCourts, store the case and
 * auto-subscribe the citizen (AGENTS.md §6, §7).
 *
 * A malformed CNR never reaches the adapter; `cached` says the 15-minute cache
 * answered, and `stale` says the adapter failed and the stored copy is shown.
 */
const lookupCase = withAuth(
  async (request, session: SessionClaims) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const result = await getCasesService().fetchByCNR(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Citizen'] },
);

export const POST = withApiHandler(lookupCase, { name: 'POST /api/cases/lookup' });
