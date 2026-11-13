import type { ReactNode } from 'react';

import { htmlLang, type Dictionary, type Locale } from '../../i18n';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import { SkipLink } from './SkipLink';

/**
 * Shared frame for login, registration and OTP pages: a calm editorial panel
 * on wide screens and a single focused card on mobile (AGENTS.md §15).
 */
export function AuthLayout({
  locale,
  dict,
  pathname,
  title,
  subtitle,
  children,
  footer,
}: {
  locale: Locale;
  dict: Dictionary;
  pathname: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const highlights = [
    dict.landing.primaryFeatureTitle,
    dict.landing.draftFeatureTitle,
    dict.landing.trackFeatureTitle,
  ];

  return (
    <div lang={htmlLang(locale)}>
      <SkipLink label={dict.common.skipToContent} />
      <SiteHeader locale={locale} dict={dict} pathname={pathname} showAuthLinks={false} />

      <main id="main-content" className="mx-auto w-full max-w-shell px-5 py-10 sm:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start">
          <aside className="relative hidden overflow-hidden rounded-[20px] bg-gradient-to-br from-[#2A4BC4] to-[#182E80] p-10 text-[#FBF9F1] lg:block">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full border border-white/10"
            />

            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C7D2F9]">
                {dict.landing.eyebrow}
              </p>
              <h2 className="mt-4 font-serif text-3xl font-semibold leading-tight text-[#FBF9F1]">
                {dict.common.tagline}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#DCE3FB]">{dict.landing.subtitle}</p>

              <ul className="mt-8 space-y-3 border-t border-white/15 pt-6 text-sm font-medium text-[#E7ECFB]">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-pill bg-[#9DB0F5]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section
            aria-labelledby="auth-heading"
            className="w-full max-w-[29rem] justify-self-center rounded-card border border-line bg-surface p-6 shadow-soft sm:p-8 lg:justify-self-end"
          >
            <h1 id="auth-heading" className="text-2xl sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">{subtitle}</p>
            {children}
            {footer ? <div className="mt-6 border-t border-line pt-5 text-sm">{footer}</div> : null}
          </section>
        </div>
      </main>

      <SiteFooter dict={dict} />
    </div>
  );
}
