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

/** PATCH /api/curator/guides/:id — edit content; status changes use actions. */
const updateGuide = withAuth<GuideRouteContext>(
  async (request, session, context) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const guideId = await guideIdFromContext(context!);
    const guide = await getGuidesService().updateGuide(
      Number(session.sub),
      guideId,
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ guide });
  },
  { roles: ['Curator'] },
);

export const PATCH = withApiHandler(updateGuide, { name: 'PATCH /api/curator/guides/:id' });
