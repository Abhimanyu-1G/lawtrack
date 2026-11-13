import { describe, expect, it } from 'vitest';

import { EnvValidationError, parseEnv } from '../../src/server/config/env';

const validEnv = (): Record<string, string | undefined> => ({
  NODE_ENV: 'development',
  PORT: '3000',
  CLIENT_ORIGIN: 'http://localhost:3000',
  JWT_SECRET: 'a'.repeat(32),
  DB_PATH: './data/lawtrack.db',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
  RAG_TOP_K: '4',
  JOBS_ENABLED: 'true',
  DEV_SHOW_OTP: 'true',
});

function expectIssues(fn: () => unknown): { key: string; message: string }[] {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return (error as EnvValidationError).issues;
  }
  throw new Error('Expected parseEnv to throw');
}

describe('environment configuration', () => {
  it('parses a complete environment and derives mock AI mode without a key', () => {
    const env = parseEnv(validEnv());

    expect(env.PORT).toBe(3000);
    expect(env.RAG_TOP_K).toBe(4);
    expect(env.JOBS_ENABLED).toBe(true);
    expect(env.DEV_SHOW_OTP).toBe(true);
    expect(env.aiMode).toBe('mock');
    expect(env.isProduction).toBe(false);
  });

  it('switches to Gemini mode when GEMINI_API_KEY is present', () => {
    const env = parseEnv({ ...validEnv(), GEMINI_API_KEY: 'key-123' });
    expect(env.aiMode).toBe('gemini');
    expect(env.GEMINI_API_KEY).toBe('key-123');
  });

  it('treats an empty GEMINI_API_KEY as absent', () => {
    const env = parseEnv({ ...validEnv(), GEMINI_API_KEY: '   ' });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.aiMode).toBe('mock');
  });

  it('fails fast when JWT_SECRET is missing', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), JWT_SECRET: undefined }));
    expect(issues.map((issue) => issue.key)).toContain('JWT_SECRET');
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), JWT_SECRET: 'short' }));
    expect(issues).toEqual([{ key: 'JWT_SECRET', message: 'must be at least 32 characters long' }]);
  });

  it('rejects a PORT outside the valid range', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), PORT: '70000' }));
    expect(issues.map((issue) => issue.key)).toContain('PORT');
  });

  it('rejects a non-numeric RAG_TOP_K', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), RAG_TOP_K: 'many' }));
    expect(issues.map((issue) => issue.key)).toContain('RAG_TOP_K');
  });

  it('rejects a malformed CLIENT_ORIGIN', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), CLIENT_ORIGIN: 'localhost:3000' }));
    expect(issues.map((issue) => issue.key)).toContain('CLIENT_ORIGIN');
  });

  it('rejects a non-boolean JOBS_ENABLED', () => {
    const issues = expectIssues(() => parseEnv({ ...validEnv(), JOBS_ENABLED: 'sometimes' }));
    expect(issues.map((issue) => issue.key)).toContain('JOBS_ENABLED');
  });

  it('reports every failing variable at once', () => {
    const issues = expectIssues(() =>
      parseEnv({ ...validEnv(), JWT_SECRET: '', CLIENT_ORIGIN: 'nope', PORT: '0' }),
    );
    expect(issues.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses the development placeholder secret in production', () => {
    const issues = expectIssues(() =>
      parseEnv({
        ...validEnv(),
        NODE_ENV: 'production',
        CLIENT_ORIGIN: 'https://lawtrack.example',
        JWT_SECRET: 'dev-only-insecure-jwt-secret-change-me-please',
      }),
    );
    expect(issues.map((issue) => issue.key)).toContain('JWT_SECRET');
  });

  it('allows the local .env for a loopback production preview', () => {
    const env = parseEnv({
      ...validEnv(),
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'http://localhost:3000',
      JWT_SECRET: 'dev-only-insecure-jwt-secret-change-me-please',
    });

    expect(env.isProduction).toBe(true);
    expect(env.CLIENT_ORIGIN).toBe('http://localhost:3000');
  });

  it('forces DEV_SHOW_OTP off in production', () => {
    const env = parseEnv({
      ...validEnv(),
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://lawtrack.example',
      JWT_SECRET: 'p'.repeat(40),
      DEV_SHOW_OTP: 'true',
    });
    expect(env.DEV_SHOW_OTP).toBe(false);
    expect(env.isProduction).toBe(true);
  });

  it('requires https for CLIENT_ORIGIN in production', () => {
    const issues = expectIssues(() =>
      parseEnv({
        ...validEnv(),
        NODE_ENV: 'production',
        CLIENT_ORIGIN: 'http://lawtrack.example',
        JWT_SECRET: 'p'.repeat(40),
      }),
    );
    expect(issues.map((issue) => issue.key)).toContain('CLIENT_ORIGIN');
  });
});
