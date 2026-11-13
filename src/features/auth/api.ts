import { CSRF_COOKIE, CSRF_HEADER } from '../../shared/session';
import type { FieldError } from '../../shared/errors';
import type { Locale } from '../../i18n';

/**
 * Small fetch wrapper for the auth screens (AGENTS.md §16).
 *
 * It always sends the double-submit CSRF header when the cookie exists, keeps
 * the request same-origin, forwards the UI language so server-side validation
 * messages match the interface, and translates the API error envelope into a
 * typed exception the forms can render field by field.
 */

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: FieldError[];

  constructor(code: string, message: string, status: number, fields: FieldError[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return null;
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: FieldError[];
  };
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  locale?: Locale;
}

export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-language': options.locale === 'hi' ? 'hi' : 'en',
  };

  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const csrfToken = readCookie(CSRF_COOKIE);
  if (csrfToken) headers[CSRF_HEADER] = csrfToken;

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError('NETWORK', 'Network request failed', 0);
  }

  if (!response.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = (await response.json()) as ErrorEnvelope;
    } catch {
      envelope = {};
    }

    throw new ApiRequestError(
      envelope.error?.code ?? 'INTERNAL_ERROR',
      envelope.error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      envelope.error?.fields ?? [],
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiRequestError('INTERNAL_ERROR', 'The server sent an unreadable response', 500);
  }
}

/** Only allow in-app relative paths as post-login destinations. */
export function safeNextPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
