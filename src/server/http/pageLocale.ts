import 'server-only';

import { cookies } from 'next/headers';

import { resolveLocale, type Locale } from '../../i18n';
import { LOCALE_COOKIE } from '../../shared/session';

/**
 * Page language resolution (PROMPTS Phase 2).
 *
 * An explicit `?lang=` wins, otherwise the language switch cookie is used, so
 * a visitor keeps Hindi while browsing server-rendered public pages.
 */
export async function pageLocale(lang?: string | null): Promise<Locale> {
  if (lang) return resolveLocale(lang);

  const store = await cookies();
  return resolveLocale(store.get(LOCALE_COOKIE)?.value);
}
