import 'server-only';

import pino, { type Logger } from 'pino';

/**
 * Structured logging with PII redaction (AGENTS.md §1.4, §16).
 *
 * Never log passwords, OTPs, tokens, cookies or the body of a legal draft.
 * Everything the product logs flows through the redaction list below, including
 * nested request/response objects.
 */

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'passwordHash',
  'password_hash',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.otp',
  '*.otpCode',
  '*.code',
  '*.code_hash',
  '*.codeHash',
  '*.jwt',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.generated_text',
  '*.generatedText',
  '*.form_data',
  '*.formData',
  '*.remarks',
  '*.question',
  '*.answer',
];

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

const baseOptions: pino.LoggerOptions = {
  level,
  base: {
    app: 'lawtrack',
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: REDACT_PATHS,
    censor: '[redacted]',
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
};

/** Create an isolated logger (mainly for scripts and tests). */
export function createLogger(options: pino.LoggerOptions = {}): Logger {
  return pino({ ...baseOptions, ...options });
}

const globalForLogger = globalThis as typeof globalThis & { __lawtrackLogger?: Logger };

/** Shared application logger. */
export const logger: Logger = globalForLogger.__lawtrackLogger ?? createLogger();
globalForLogger.__lawtrackLogger = logger;

/** Logger bound to a request id, used by every API route. */
export function requestLogger(requestId: string, extra: Record<string, unknown> = {}): Logger {
  return logger.child({ requestId, ...extra });
}
