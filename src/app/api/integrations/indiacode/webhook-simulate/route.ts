import { getIntegrationsService } from '@/server/modules/integrations';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/integrations/indiacode/webhook-simulate — mock legislative change
 * (AGENTS.md §11, UC-05). Flags published guides in the topic, notifies every
 * curator and writes an audit row. Restricted to Administrators and API
 * Managers; the real webhook would be signature-verified instead.
 */
const simulateLegislativeChange = withAuth(
  async (request, session) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const result = await getIntegrationsService().simulateLegislativeChange(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const POST = withApiHandler(simulateLegislativeChange, {
  name: 'POST /api/integrations/indiacode/webhook-simulate',
});
