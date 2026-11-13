'use client';

import Link from 'next/link';

import type { Dictionary, Locale } from '../../i18n';
import { rememberLocale } from './localeCookie';

/**
 * EN / हिं switch. Keeps the current path and changes the `lang` query
 * parameter, and remembers the choice in a cookie so later server-rendered
 * pages open in the same language without the parameter.
 */
export function LanguageSwitch({
  locale,
  dict,
  pathname,
}: {
  locale: Locale;
  dict: Dictionary;
  pathname: string;
}) {
  const options: { value: Locale; label: string }[] = [
    { value: 'en', label: dict.common.english },
    { value: 'hi', label: dict.common.hindi },
  ];

  function remember(value: Locale): void {
    rememberLocale(value);
  }

  return (
    <nav
      aria-label={dict.common.languageLabel}
      className="inline-flex rounded-pill border border-line bg-surface p-0.5"
    >
      {options.map((option) => {
        const active = option.value === locale;
        return (
          <Link
            key={option.value}
            href={{ pathname, query: { lang: option.value } }}
            hrefLang={option.value}
            aria-current={active ? 'true' : undefined}
            onClick={() => remember(option.value)}
            className={`inline-flex h-9 items-center rounded-pill px-3 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-ink'
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
