import { parseLanguageQuery } from '@/shared/guideFilters';
import { getGuidesService } from '@/server/modules/guides';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides — public, Valid-only guide browsing (AGENTS.md §3, §7).
 * `?lang=en|hi`, `?category=`, `?q=`, `?page=`, `?pageSize=`.
 */
const listGuides = withApiHandler(
  async (request) => {
    const url = new URL(request.url);
    const result = await getGuidesService().listPublic({
      category: url.searchParams.get('category') ?? undefined,
      query: url.searchParams.get('q') ?? undefined,
      language: parseLanguageQuery(
        url.searchParams.get('lang') ?? url.searchParams.get('language'),
      ),
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
    });

    return jsonResponse({
      guides: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  },
  { name: 'GET /api/guides' },
);

export const GET = listGuides;
