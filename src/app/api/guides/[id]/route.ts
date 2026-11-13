import { getGuidesService } from '@/server/modules/guides';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { getOptionalSession } from '@/server/http/session';
import { guideIdFromContext, type GuideRouteContext } from '@/server/http/guideRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/:id — public detail. A signed-in Citizen's view is recorded
 * for "continue where you left off"; anonymous readers are not tracked.
 */
const getGuide = withApiHandler<GuideRouteContext>(
  async (request, context) => {
    const guideId = await guideIdFromContext(context!);
    const viewer = await getOptionalSession(request);
    const guide = await getGuidesService().detailPublic(guideId, viewer);
    return jsonResponse({ guide });
  },
  { name: 'GET /api/guides/:id' },
);

export const GET = getGuide;
