import { getDraftsService } from '@/server/modules/drafts';
import { withAuth } from '@/server/http/auth';
import {
  jsonResponse,
  readJsonBody,
  requireJsonContentType,
  withApiHandler,
} from '@/server/http/handler';
import { localeFromRequest } from '@/server/http/locale';
import type { SessionClaims } from '@/shared/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/lawyer/status — set Available / Busy / Offline. */
const updateStatus = withAuth(
  async (request, session: SessionClaims) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const result = await getDraftsService().setLawyerStatus(
      Number(session.sub),
      body,
      localeFromRequest(request),
    );
    return jsonResponse(result);
  },
  { roles: ['Lawyer'] },
);

export const PATCH = withApiHandler(updateStatus, { name: 'PATCH /api/lawyer/status' });
