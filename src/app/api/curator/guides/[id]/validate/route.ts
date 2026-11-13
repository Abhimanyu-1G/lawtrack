import { getGuidesService } from '@/server/modules/guides';
import { withAuth } from '@/server/http/auth';
import { guideIdFromContext, type GuideRouteContext } from '@/server/http/guideRoute';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/curator/guides/:id/validate — publish after curator review. */
const validateGuide = withAuth<GuideRouteContext>(
  async (request, session, context) => {
    const guideId = await guideIdFromContext(context!);
    const guide = await getGuidesService().validateGuide(
      Number(session.sub),
      guideId,
      localeFromRequest(request),
    );
    return jsonResponse({ guide });
  },
  { roles: ['Curator'] },
);

export const POST = withApiHandler(validateGuide, { name: 'POST /api/curator/guides/:id/validate' });
