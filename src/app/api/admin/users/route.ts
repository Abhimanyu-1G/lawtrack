import { USER_ROLES, type UserRole } from '@/shared/enums';
import { getAdminUserService } from '@/server/modules/admin';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseRole(value: string | null): UserRole | undefined {
  if (!value) return undefined;
  return (USER_ROLES as readonly string[]).includes(value) ? (value as UserRole) : undefined;
}

/** GET /api/admin/users — paginated directory with optional role/search filter. */
const listUsers = withAuth(
  async (request) => {
    const url = new URL(request.url);
    const result = await getAdminUserService().list({
      role: parseRole(url.searchParams.get('role')),
      query: url.searchParams.get('q') ?? undefined,
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
    });
    return jsonResponse(result);
  },
  { roles: ['Administrator'] },
);

/** POST /api/admin/users — create a staff account (never a second public sign-up). */
const createUser = withAuth(
  async (request, session) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const user = await getAdminUserService().create(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse({ user }, { status: 201 });
  },
  { roles: ['Administrator'] },
);

export const GET = withApiHandler(listUsers, { name: 'GET /api/admin/users' });
export const POST = withApiHandler(createUser, { name: 'POST /api/admin/users' });
