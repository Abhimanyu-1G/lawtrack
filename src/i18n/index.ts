import en from './en.json';
import hi from './hi.json';

/**
 * i18n dictionaries (AGENTS.md §1.8). Every user-visible string lives here;
 * components never hard-code copy. Hindi is typed against the English shape so
 * a missing translation is a type error.
 */

export type Locale = 'en' | 'hi';
export type Dictionary = typeof en;

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALES: Locale[] = ['en', 'hi'];

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  hi: hi satisfies Dictionary,
};

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'hi';
}

export function resolveLocale(value?: string | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Fill `{{placeholders}}` in a dictionary template (EN/HI share the syntax). */
export function formatMessage(
  template: string,
  values: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Locale tag for the `<html lang>` attribute and Intl formatting. */
export function htmlLang(locale: Locale): string {
  return locale === 'hi' ? 'hi-IN' : 'en-IN';
}

/**
 * Display label for a guide category. Categories are stored under their stable
 * English names (they are the database values), so the dictionary translates
 * them for the interface and falls back to the stored name for any extra value
 * a curator may add later.
 */
export function categoryLabel(dict: Dictionary, category: string): string {
  const labels = dict.knowledge.categories as Record<string, string | undefined>;
  return labels[category] ?? category;
}
