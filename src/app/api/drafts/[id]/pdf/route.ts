import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import { draftIdFromContext, type DraftRouteContext } from '@/server/http/draftRoute';
import { withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/drafts/:id/pdf — the approved draft as a PDF. Returns
 * `409 DRAFT_NOT_APPROVED` until a lawyer approves the draft.
 */
const exportPdf = withAuth<DraftRouteContext>(
  async (request, session: SessionClaims, context) => {
    const draftId = await draftIdFromContext(context!);
    const pdf = await getDraftsService().exportPDF(
      Number(session.sub),
      draftId,
      localeFromRequest(request),
    );

    return new Response(pdf.bytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${pdf.fileName}"`,
        'content-length': String(pdf.bytes.byteLength),
        'cache-control': 'no-store',
      },
    });
  },
  { roles: ['Citizen'] },
);

export const GET = withApiHandler(exportPdf, { name: 'GET /api/drafts/:id/pdf' });
