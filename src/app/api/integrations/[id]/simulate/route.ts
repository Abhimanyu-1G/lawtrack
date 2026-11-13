import { getIntegrationsService } from '@/server/modules/integrations';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/integrations/:id/simulate — dev-only outage simulator for eCourts
 * (Administrator + API Manager).
 */
const simulateOutage = withAuth<RouteContext>(
  async (request, _session, context) => {
    const { id: rawId } = await context!.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id < 1) {
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Integration not found' } }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    if (id !== 1) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'Only eCourts (id 1) supports simulation' } }),
        {
          status: 422,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      );
    }

    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const enabled = typeof record.enabled === 'boolean' ? record.enabled : false;

    const result = await getIntegrationsService().simulateOutage(enabled);
    return jsonResponse({ outage: result.outage });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const POST = withApiHandler<RouteContext>(simulateOutage, { name: 'POST /api/integrations/:id/simulate' });