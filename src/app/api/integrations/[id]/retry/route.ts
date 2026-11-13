import { getIntegrationsService } from '@/server/modules/integrations';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/integrations/:id/retry — force a retry of the same probe
 * (Administrator + API Manager).
 */
const retryIntegration = withAuth<RouteContext>(
  async (_request, _session, context) => {
    const { id: rawId } = await context!.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) {
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Integration not found' } }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const result = await getIntegrationsService().retry(id);
    return jsonResponse({ integration: result });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const POST = withApiHandler<RouteContext>(retryIntegration, { name: 'POST /api/integrations/:id/retry' });