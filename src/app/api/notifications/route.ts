import { getNotificationsService } from '@/server/modules/notifications';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/notifications — the signed-in user's notification centre. */
const listNotifications = withAuth(async (request, session) => {
  const url = new URL(request.url);
  const result = await getNotificationsService().list(Number(session.sub), {
    unreadOnly: url.searchParams.get('unreadOnly') === 'true',
    page: url.searchParams.get('page'),
    pageSize: url.searchParams.get('pageSize'),
  });
  return jsonResponse(result);
});

export const GET = withApiHandler(listNotifications, { name: 'GET /api/notifications' });
