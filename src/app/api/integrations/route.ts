import { getIntegrationsService } from '@/server/modules/integrations';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/integrations — list all integrations with health (Administrator + API Manager). */
const listIntegrations = withAuth(
  async () => {
    const integrations = await getIntegrationsService().list();
    return jsonResponse({ integrations });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const GET = withApiHandler(listIntegrations, { name: 'GET /api/integrations' });