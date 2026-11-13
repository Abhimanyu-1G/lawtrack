import { getGuidesService } from '@/server/modules/guides';
import { withAuth } from '@/server/http/auth';
import { guideIdFromContext, type GuideRouteContext } from '@/server/http/guideRoute';
import {
  jsonResponse,
  readJsonBody,
  requireJsonContentType,
  withApiHandler,
} from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/curator/guides/:id/flag — Valid → Requires AI Update, with reason. */
const flagGuide = withAuth<GuideRouteContext>(
  async (request, session, context) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const guideId = await guideIdFromContext(context!);
    const guide = await getGuidesService().flagGuide(
      Number(session.sub),
      guideId,
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ guide });
  },
  { roles: ['Curator'] },
);

export const POST = withApiHandler(flagGuide, { name: 'POST /api/curator/guides/:id/flag' });
