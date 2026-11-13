import { getNotificationsService } from '@/server/modules/notifications';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/notifications/read-all — clears the bell badge in one call. */
const markAllRead = withAuth(async (_request, session) => {
  const result = await getNotificationsService().markAllRead(Number(session.sub));
  return jsonResponse(result);
});

export const POST = withApiHandler(markAllRead, { name: 'POST /api/notifications/read-all' });
