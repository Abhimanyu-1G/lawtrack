import { afterAll, describe, expect, it } from 'vitest';

import { GET } from '../../src/app/api/health/route';
import { closeDb } from '../../src/server/db/client';

/**
 * Route handlers are called directly with a `Request` — no HTTP server, no
 * network (AGENTS.md §0). DB_PATH is `:memory:` from tests/setup.ts.
 */

afterAll(async () => {
  await closeDb();
});

describe('GET /api/health', () => {
  it('reports a healthy service with the database up', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string; migrationsApplied: number; migrations: string[] } };
      features: { aiMode: string; jobsEnabled: boolean };
      version: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(body.status).toBe('healthy');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(body.checks.database.status).toBe('up');
    expect(body.checks.database.migrations).toContain('0001_init.sql');
    expect(body.checks.database.migrationsApplied).toBeGreaterThanOrEqual(1);
    expect(body.features.aiMode).toBe('mock');
    expect(body.features.jobsEnabled).toBe(false);
  });

  it('echoes a valid incoming request id', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/health', {
        headers: { 'x-request-id': 'req-test-123' },
      }),
    );

    expect(response.headers.get('x-request-id')).toBe('req-test-123');
  });

  it('generates a request id when none is supplied', async () => {
    const response = await GET(new Request('http://localhost:3000/api/health'));
    const requestId = response.headers.get('x-request-id');

    expect(requestId).toBeTruthy();
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores a request id value outside the allowed charset', async () => {
    const response = await GET(
      new Request('http://localhost:3000/api/health', {
        headers: { 'x-request-id': 'evil value with spaces' },
      }),
    );

    expect(response.headers.get('x-request-id')).not.toBe('evil value with spaces');
    expect(response.headers.get('x-request-id')).toHaveLength(36);
  });
});
