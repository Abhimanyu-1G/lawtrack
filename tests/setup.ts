import { beforeAll } from 'vitest';

/**
 * Deterministic test environment. `DB_PATH=:memory:` keeps every test file on a
 * throwaway database; tests that need a handle create one with
 * `createInMemoryDatabase()`.
 */
beforeAll(() => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-0123456789-abcdefghijklmnopqrstuv',
    CLIENT_ORIGIN: 'http://localhost:3000',
    DB_PATH: ':memory:',
    JOBS_ENABLED: 'false',
    DEV_SHOW_OTP: 'false',
    LOG_LEVEL: 'silent',
  });
  delete process.env.GEMINI_API_KEY;
});
