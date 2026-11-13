import { JOB_NAMES, runJob, type JobName } from '@/server/jobs';
import { withAuth } from '@/server/http/auth';
import { jsonResponse, readJsonBody, requireJsonContentType, withApiHandler } from '@/server/http/handler';
import { validationFailed } from '@/server/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/run — manual trigger for a background job (AGENTS.md §12).
 *
 * Administrators and API managers use this from the operations console, and a
 * serverless deployment would point an external scheduler at it (D-51).
 */
const runBackgroundJob = withAuth(
  async (request) => {
    requireJsonContentType(request);
    const body = await readJsonBody(request);
    const record =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    const job = typeof record.job === 'string' ? record.job.trim() : '';

    if (!(JOB_NAMES as readonly string[]).includes(job)) {
      throw validationFailed([
        {
          field: 'job',
          code: 'ENUM',
          message: `Job must be one of: ${JOB_NAMES.join(', ')}`,
        },
      ]);
    }

    const outcome = await runJob(job as JobName);
    return jsonResponse(outcome);
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const POST = withApiHandler(runBackgroundJob, { name: 'POST /api/jobs/run' });
