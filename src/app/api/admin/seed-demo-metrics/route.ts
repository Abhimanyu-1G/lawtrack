import { withAuth } from '@/server/http/auth';
import { jsonResponse, withApiHandler } from '@/server/http/handler';
import { seedDemoMetrics } from '../../../../../scripts/seed-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const seedMetrics = withAuth(
  async () => {
    await seedDemoMetrics();
    return jsonResponse({ ok: true });
  },
  { roles: ['Administrator', 'API Manager'] },
);

export const POST = withApiHandler(seedMetrics, { name: 'POST /api/admin/seed-demo-metrics' });