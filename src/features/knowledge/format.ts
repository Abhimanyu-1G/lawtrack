import type { Locale } from '../../i18n';

/**
 * Display a stored UTC timestamp as a short Asia/Kolkata date. Values come from
 * the database as `YYYY-MM-DD HH:MM:SS`; an unreadable value falls back to its
 * date part so the page never shows "Invalid Date".
 */
export function formatGuideDate(value: string, locale: Locale): string {
  const iso = `${value.trim().replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}
