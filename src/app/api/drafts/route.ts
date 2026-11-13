import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  /api/drafts — the citizen's own drafts, newest first.
 * POST /api/drafts — validate the wizard answers, generate the draft with the
 * AI provider and save it as `Pending Review` version 1.
 */

const listDrafts = withAuth(
  async (_request, session: SessionClaims) => {
    const drafts = await getDraftsService().listForCitizen(Number(session.sub));
    return jsonResponse({ drafts, demo: getDraftsService().demoMode });
  },
  { roles: ['Citizen'] },
);

const createDraft = withAuth(
  async (request, session: SessionClaims) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const draft = await getDraftsService().createDraft(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ draft, demo: getDraftsService().demoMode }, { status: 201 });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(listDrafts, { name: 'GET /api/drafts' });
export const POST = withApiHandler(createDraft, { name: 'POST /api/drafts' });
