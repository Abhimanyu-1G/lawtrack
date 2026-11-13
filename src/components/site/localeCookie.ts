import { LOCALE_COOKIE } from '../../shared/session';
import type { Locale } from '../../i18n';

/**
 * Remember the public-page language in a cookie (PROMPTS Phase 2). Kept out of
 * the component so the React compiler's immutability rule is not triggered by
 * a direct `document.cookie` assignment.
 */
export function rememberLocale(value: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}
