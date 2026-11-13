import { getAdminUserService } from '@/server/modules/admin';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import { AppError } from '@/server/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UserRouteContext {
  params: Promise<{ id: string }>;
}

function parseUserId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new AppError('NOT_FOUND', 'User not found');
  return id;
}

/** PATCH /api/admin/users/:id — change a role or preferred language. */
const updateUser = withAuth<UserRouteContext>(
  async (request, session, context) => {
    requireJsonContentType(request);
    const { id } = await context!.params;
    const userId = parseUserId(id);
    const body = await readJsonBody(request);
    const user = await getAdminUserService().update(
      Number(session.sub),
      userId,
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ user });
  },
  { roles: ['Administrator'] },
);

export const PATCH = withApiHandler(updateUser, { name: 'PATCH /api/admin/users/:id' });
