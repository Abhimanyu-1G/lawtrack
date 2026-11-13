import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import {
  jsonResponse,
  readJsonBody,
  requireJsonContentType,
  withApiHandler,
} from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lawyer/drafts/:id/reject — remarks are required (≥10 chars). The
 * draft is regenerated immediately with the remarks; if the AI is unavailable
 * the citizen can retry from the draft page.
 */
const rejectDraft = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    requireJsonContentType(request);
    const draftId = await draftIdFromContext(context!);
    const body = await readJsonBody(request);
    const result = await getDraftsService().reject(
      Number(session.sub),
      draftId,
      body,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Lawyer'] },
);

export const POST = withApiHandler(rejectDraft, { name: 'POST /api/lawyer/drafts/:id/reject' });
