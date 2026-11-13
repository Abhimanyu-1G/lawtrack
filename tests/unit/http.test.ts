import { describe, expect, it } from 'vitest';

import { AppError, toErrorBody } from '../../src/server/lib/errors';
import { isValidRequestId, resolveRequestId } from '../../src/server/http/requestId';

describe('request id', () => {
  it('accepts a conservative charset', () => {
    expect(isValidRequestId('abc-123_XY.z')).toBe(true);
  });

  it('rejects header injection and oversized values', () => {
    expect(isValidRequestId('bad value')).toBe(false);
    expect(isValidRequestId('x'.repeat(65))).toBe(false);
    expect(isValidRequestId('')).toBe(false);
  });

  it('keeps a valid provided id and replaces an invalid one', () => {
    const kept = resolveRequestId(
      new Request('http://localhost/', { headers: { 'x-request-id': 'trace-42' } }),
    );
    expect(kept).toBe('trace-42');

    const replaced = resolveRequestId(
      new Request('http://localhost/', { headers: { 'x-request-id': 'a b' } }),
    );
    expect(replaced).not.toBe('a b');
    expect(replaced).toHaveLength(36);
  });
});

describe('central error contract', () => {
  it('maps an AppError to its status and body', () => {
    const mapped = toErrorBody(new AppError('NOT_FOUND', 'Guide not found', { status: 404 }), 'req-1');

    expect(mapped.status).toBe(404);
    expect(mapped.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Guide not found', requestId: 'req-1' },
    });
  });

  it('keeps field errors on validation failures', () => {
    const mapped = toErrorBody(
      new AppError('VALIDATION_FAILED', 'Some fields need attention', {
        fields: [{ field: 'email', code: 'FORMAT', message: 'Enter a valid email address' }],
      }),
      'req-2',
    );

    expect(mapped.status).toBe(422);
    expect(mapped.body.error.fields).toEqual([
      { field: 'email', code: 'FORMAT', message: 'Enter a valid email address' },
    ]);
  });

  it('hides internals of unexpected errors behind a generic 500', () => {
    const mapped = toErrorBody(new Error('SQLITE_CORRUPT: secret path /var/db'), 'req-3');

    expect(mapped.status).toBe(500);
    expect(mapped.body.error.code).toBe('INTERNAL_ERROR');
    expect(mapped.body.error.message).not.toContain('SQLITE');
    expect(mapped.body.error.requestId).toBe('req-3');
  });
});
