import { getIntegrationsService } from '@/server/modules/integrations';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/integrations/:id/logs — recent audit rows mentioning this integration
 * (Administrator + API Manager).
 */
const integrationLogs = withAuth<RouteContext>(
  async (_request, _session, context) => {
    const { id: rawId } = await context!.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) {
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Integration not found' } }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const logs = await getIntegrationsService().logs(id);
    return jsonResponse({ logs });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const GET = withApiHandler<RouteContext>(integrationLogs, { name: 'GET /api/integrations/:id/logs' });