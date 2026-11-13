import { getGuidesService } from '@/server/modules/guides';
import { withAuth } from '@/server/http/auth';
import { guideIdFromContext, type GuideRouteContext } from '@/server/http/guideRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/curator/guides/:id/resimplify — returns a suggestion, never saves. */
const resimplify = withAuth<GuideRouteContext>(
  async (request, _session, context) => {
    const guideId = await guideIdFromContext(context!);
    const suggestion = await getGuidesService().resimplifyGuide(
      guideId,
      localeFromRequest(request),
    );
    return jsonResponse({ suggestion });
  },
  { roles: ['Curator'] },
);

export const POST = withApiHandler(resimplify, { name: 'POST /api/curator/guides/:id/resimplify' });
