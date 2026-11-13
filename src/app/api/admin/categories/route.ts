import { getAdminCategoriesService } from '@/server/modules/admin';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/categories — ordered categories with their guide counts. */
const listCategories = withAuth(
  async () => {
    const categories = await getAdminCategoriesService().list();
    return jsonResponse({ categories });
  },
  { roles: ['Administrator'] },
);

/** PUT /api/admin/categories — replace the ordered category list. */
const replaceCategories = withAuth(
  async (request, session) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const categories = await getAdminCategoriesService().replace(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ categories });
  },
  { roles: ['Administrator'] },
);

export const GET = withApiHandler(listCategories, { name: 'GET /api/admin/categories' });
export const PUT = withApiHandler(replaceCategories, { name: 'PUT /api/admin/categories' });
