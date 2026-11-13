import { getAuditService } from '@/server/modules/audit';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import type { AuditFilter } from '@/server/modules/audit/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit-logs — privileged-action trail with filters, pagination
 * and CSV export (`?format=csv`). Administrators only.
 */
function filtersFrom(url: URL): AuditFilter {
  const actor = url.searchParams.get('actorId');
  const actorId = actor ? Number(actor) : undefined;
  return {
    actorId: Number.isInteger(actorId) && (actorId ?? 0) > 0 ? actorId : undefined,
    action: url.searchParams.get('action') || undefined,
    from: url.searchParams.get('from') || undefined,
    to: url.searchParams.get('to') || undefined,
    page: url.searchParams.get('page'),
    pageSize: url.searchParams.get('pageSize'),
  };
}

const listAuditLogs = withAuth(
  async (request) => {
    const url = new URL(request.url);

    if (url.searchParams.get('format') === 'csv') {
      const csv = await getAuditService().toCsv(filtersFrom(url));
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="lawtrack-audit-log.csv"',
          'cache-control': 'no-store',
        },
      });
    }

    const [page, actions] = await Promise.all([
      getAuditService().list(filtersFrom(url)),
      getAuditService().actions(),
    ]);
    return jsonResponse({ ...page, actions });
  },
  { roles: ['Administrator'] },
);

export const GET = withApiHandler(listAuditLogs, { name: 'GET /api/admin/audit-logs' });
