import { getMetricsService } from '@/server/modules/metrics';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/metrics/summary?range=7|30 — the ten Lab-7 metrics with their
 * targets, verdicts and daily series (AGENTS.md §14).
 */
const getSummary = withAuth(
  async (request) => {
    const value = new URL(request.url).searchParams.get('range');
    const rangeDays = value === '30' ? 30 : 7;
    const summary = await getMetricsService().getSummary(rangeDays);
    return jsonResponse({ summary });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const GET = withApiHandler(getSummary, { name: 'GET /api/metrics/summary' });
