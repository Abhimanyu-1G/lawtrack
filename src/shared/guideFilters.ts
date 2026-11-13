import type { GuideStatus, Language } from './enums';
import { GUIDE_STATUSES } from './enums';

/**
 * Query-string normalisation for guide browsing (Phase 3). Pages and route
 * handlers share it so `?lang=hi` and `?language=Hindi` behave the same.
 */

export function parseLanguageQuery(value: string | null | undefined): Language | undefined {
  if (!value) return undefined;
  const normalised = value.trim().toLowerCase();
  if (normalised === 'hi' || normalised === 'hindi') return 'Hindi';
  if (normalised === 'en' || normalised === 'english') return 'English';
  return undefined;
}

export function localeFromLanguage(language: Language | undefined): 'en' | 'hi' {
  return language === 'Hindi' ? 'hi' : 'en';
}

export function parseGuideStatus(value: string | null | undefined): GuideStatus | undefined {
  if (!value) return undefined;
  const normalised = value.trim();
  return (GUIDE_STATUSES as readonly string[]).includes(normalised)
    ? (normalised as GuideStatus)
    : undefined;
}
