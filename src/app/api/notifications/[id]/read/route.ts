import { getNotificationsService } from '@/server/modules/notifications';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { AppError } from '@/server/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NotificationRouteContext {
  params: Promise<{ id: string }>;
}

/** POST /api/notifications/:id/read — ownership enforced by the repository. */
const markRead = withAuth<NotificationRouteContext>(async (_request, session, context) => {
  const { id } = await context!.params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId < 1) {
    throw new AppError('NOT_FOUND', 'Notification not found');
  }

  await getNotificationsService().markRead(Number(session.sub), notificationId);
  return jsonResponse({ ok: true });
});

export const POST = withApiHandler(markRead, { name: 'POST /api/notifications/:id/read' });
