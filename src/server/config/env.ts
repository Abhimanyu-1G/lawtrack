import 'server-only';

import { z } from 'zod';

/**
 * Environment parsing (AGENTS.md §2, §16). Fail fast: a bad environment is a
 * boot error, never a silent fallback in production.
 *
 * The loader is pure (`parseEnv`) so it can be unit-tested without touching
 * `process.env`, and memoized (`getEnv`) so request handlers share one result.
 */

const booleanString = z.preprocess(
  (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
      if (['false', '0', 'no', 'off', ''].includes(normalised)) return false;
    }
    return value;
  },
  z.boolean({ error: 'must be true or false' }),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce
    .number({ error: 'must be a number' })
    .int('must be a whole number')
    .min(1, 'must be between 1 and 65535')
    .max(65535, 'must be between 1 and 65535')
    .default(3000),
  CLIENT_ORIGIN: z
    .string({ error: 'is required' })
    .trim()
    .min(1, 'is required')
    .refine(
      (value) => {
        try {
          const url = new URL(value);
          return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'must be an absolute http(s) URL, e.g. http://localhost:3000' },
    ),
  JWT_SECRET: z
    .string({ error: 'is required' })
    .min(32, 'must be at least 32 characters long')
    .max(512, 'must be at most 512 characters long'),
  DB_PATH: z.string({ error: 'is required' }).trim().min(1, 'is required').default('./data/lawtrack.db'),
  GEMINI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  GEMINI_MODEL: z.string().trim().min(1, 'is required').default('gemini-3.8-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().trim().min(1, 'is required').default('gemini-embedding-001'),
  RAG_TOP_K: z.coerce
    .number({ error: 'must be a number' })
    .int('must be a whole number')
    .min(1, 'must be between 1 and 20')
    .max(20, 'must be between 1 and 20')
    .default(4),
  JOBS_ENABLED: booleanString.default(true),
  DEV_SHOW_OTP: booleanString.default(false),
  ECOURTS_MODE: z.enum(['mock', 'real']).default('mock'),
});

export type AiMode = 'gemini' | 'mock';
export type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  NODE_ENV: NodeEnv;
  isProduction: boolean;
  isTest: boolean;
  PORT: number;
  CLIENT_ORIGIN: string;
  JWT_SECRET: string;
  DB_PATH: string;
  GEMINI_API_KEY: string | undefined;
  GEMINI_MODEL: string;
  GEMINI_EMBEDDING_MODEL: string;
  RAG_TOP_K: number;
  JOBS_ENABLED: boolean;
  /** Always false in production, even when the env var says otherwise. */
  DEV_SHOW_OTP: boolean;
  /** `mock` (default) keeps eCourts lookups offline and deterministic. */
  ECOURTS_MODE: 'mock' | 'real';
  /** Mock AI keeps the whole product usable offline (AGENTS.md §10). */
  aiMode: AiMode;
}

export interface EnvIssue {
  key: string;
  message: string;
}

export class EnvValidationError extends Error {
  readonly issues: EnvIssue[];

  constructor(issues: EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues.map((issue) => `  - ${issue.key}: ${issue.message}`).join('\n')}\n` +
        'Copy .env.example to .env and fill in the missing values.',
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

const DEV_PLACEHOLDER_SECRET = 'dev-only-insecure-jwt-secret-change-me-please';

/**
 * `next start` always runs with NODE_ENV=production. A preview bound to the
 * loopback interface is not a deployment: it keeps working with the local
 * `.env` so `npm run build && npm start` can be checked on a developer machine.
 * Every real origin still has to use https and a unique secret.
 */
function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Validate a raw environment bag. Throws `EnvValidationError` listing *all*
 * problems at once so a developer fixes the file in one pass.
 */
export function parseEnv(raw: Record<string, string | undefined> = process.env): AppEnv {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues: EnvIssue[] = result.error.issues.map((issue) => ({
      key: issue.path.length > 0 ? issue.path.join('.') : 'environment',
      message: issue.message,
    }));
    throw new EnvValidationError(issues);
  }

  const parsed = result.data;
  const isProduction = parsed.NODE_ENV === 'production';
  const isLocalPreview = isProduction && isLoopbackOrigin(parsed.CLIENT_ORIGIN);
  const issues: EnvIssue[] = [];

  if (isProduction && !isLocalPreview && parsed.JWT_SECRET === DEV_PLACEHOLDER_SECRET) {
    issues.push({
      key: 'JWT_SECRET',
      message: 'is still the development placeholder; set a unique secret before deploying',
    });
  }
  if (isProduction && !isLocalPreview && parsed.CLIENT_ORIGIN.startsWith('http://')) {
    issues.push({ key: 'CLIENT_ORIGIN', message: 'must use https in production' });
  }
  if (issues.length > 0) throw new EnvValidationError(issues);

  return {
    ...parsed,
    isProduction,
    isTest: parsed.NODE_ENV === 'test',
    DEV_SHOW_OTP: isProduction ? false : parsed.DEV_SHOW_OTP,
    aiMode: parsed.GEMINI_API_KEY ? 'gemini' : 'mock',
  };
}

interface EnvCache {
  env?: AppEnv;
}

const globalForEnv = globalThis as typeof globalThis & { __lawtrackEnv?: EnvCache };
const cache: EnvCache = globalForEnv.__lawtrackEnv ?? (globalForEnv.__lawtrackEnv = {});

/** Memoized accessor used by request handlers, services and jobs. */
export function getEnv(): AppEnv {
  cache.env ??= parseEnv(process.env);
  return cache.env;
}

/** Test helper: forget the memoized environment. */
export function resetEnvCache(): void {
  cache.env = undefined;
}
