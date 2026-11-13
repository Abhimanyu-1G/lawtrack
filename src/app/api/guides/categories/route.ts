import { parseLanguageQuery } from '@/shared/guideFilters';
import { getGuidesService } from '@/server/modules/guides';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/guides/categories — Valid guide counts per topic, in seed order. */
const listCategories = withApiHandler(
  async (request) => {
    const url = new URL(request.url);
    const categories = await getGuidesService().categories(
      parseLanguageQuery(url.searchParams.get('lang') ?? url.searchParams.get('language')),
    );
    return jsonResponse({ categories });
  },
  { name: 'GET /api/guides/categories' },
);

export const GET = listCategories;
