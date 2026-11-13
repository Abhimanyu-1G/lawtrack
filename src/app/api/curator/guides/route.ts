import { parseGuideStatus } from '@/shared/guideFilters';
import { getGuidesService } from '@/server/modules/guides';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/curator/guides — every status, with filter counts. Curator only
 * (AGENTS.md §3, §7); the route wrapper enforces both role and CSRF rules.
 */
const listForCurator = withAuth(
  async (request) => {
    const url = new URL(request.url);
    const service = getGuidesService();
    const [result, counts] = await Promise.all([
      service.listForCurator({
        category: url.searchParams.get('category') ?? undefined,
        query: url.searchParams.get('q') ?? undefined,
        status: parseGuideStatus(url.searchParams.get('status')),
        page: url.searchParams.get('page'),
        pageSize: url.searchParams.get('pageSize'),
      }),
      service.statusCounts(),
    ]);

    return jsonResponse({
      guides: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
      counts,
    });
  },
  { roles: ['Curator'] },
);

export const GET = withApiHandler(listForCurator, { name: 'GET /api/curator/guides' });
