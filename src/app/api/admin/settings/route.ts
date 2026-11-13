import { getSettingsService } from '@/server/modules/settings';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/settings — editable platform settings with their bounds. */
const listSettings = withAuth(
  async () => {
    const settings = await getSettingsService().list();
    return jsonResponse({ settings });
  },
  { roles: ['Administrator'] },
);

/** PUT /api/admin/settings — validate, persist, audit and apply the AI switch. */
const updateSettings = withAuth(
  async (request, session) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const settings = await getSettingsService().update(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ settings });
  },
  { roles: ['Administrator'] },
);

export const GET = withApiHandler(listSettings, { name: 'GET /api/admin/settings' });
export const PUT = withApiHandler(updateSettings, { name: 'PUT /api/admin/settings' });
