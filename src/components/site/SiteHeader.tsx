import Link from 'next/link';

import type { Dictionary, Locale } from '../../i18n';
import { LanguageSwitch } from './LanguageSwitch';
import { Wordmark } from './Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * Public top bar: wordmark, Knowledge Hub link, language switch, theme toggle
 * and either the auth actions or a link back to the signed-in workspace.
 */
export function SiteHeader({
  locale,
  dict,
  pathname,
  showAuthLinks = true,
  workspaceHref,
}: {
  locale: Locale;
  dict: Dictionary;
  pathname: string;
  showAuthLinks?: boolean;
  workspaceHref?: string | null;
}) {
  const onKnowledge = pathname.startsWith('/knowledge');

  return (
    <header className="border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-shell flex-wrap items-center justify-between gap-3 px-5 py-3 sm:h-18 sm:flex-nowrap sm:px-8 sm:py-0">
        <Link href="/" className="rounded-input" aria-label={dict.common.appName}>
          <Wordmark />
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <nav aria-label={dict.common.mainNav} className="flex items-center gap-1">
            <Link
              href={{ pathname: '/knowledge', query: { lang: locale } }}
              aria-current={onKnowledge ? 'page' : undefined}
              className={`inline-flex h-9 items-center rounded-input px-3 text-sm font-medium transition-colors hover:bg-primary-tint hover:text-primary ${
                onKnowledge ? 'bg-primary-tint text-primary' : 'text-ink'
              }`}
            >
              {dict.common.knowledgeHub}
            </Link>
          </nav>

          <LanguageSwitch locale={locale} dict={dict} pathname={pathname} />
          <ThemeToggle label={dict.common.themeToggle} />

          {showAuthLinks ? (
            <nav aria-label={dict.common.mainNav} className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href={{ pathname: '/login', query: { lang: locale } }}
                className="inline-flex h-9 items-center rounded-input px-3 text-sm font-medium text-ink transition-colors hover:bg-primary-tint hover:text-primary"
              >
                {dict.auth.signIn}
              </Link>
              <Link
                href={{ pathname: '/register', query: { lang: locale } }}
                className="inline-flex h-9 items-center rounded-input bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed"
              >
                {dict.auth.createAccount}
              </Link>
            </nav>
          ) : workspaceHref ? (
            <Link
              href={workspaceHref}
              className="inline-flex h-9 items-center rounded-input bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed"
            >
              {dict.common.workspaceHome}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
