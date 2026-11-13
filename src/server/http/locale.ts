import 'server-only';

import type { Locale } from '../../i18n';

/**
 * Resolve the response language from `Accept-Language`. Only English and Hindi
 * are supported; anything else falls back to English (AGENTS.md §0).
 */
export function localeFromRequest(request: Request): Locale {
  const header = request.headers.get('accept-language') ?? '';
  const first = (header.split(',')[0] ?? '').trim().toLowerCase();
  return first.startsWith('hi') ? 'hi' : 'en';
}
