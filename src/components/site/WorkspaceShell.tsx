import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Dictionary, Locale } from '../../i18n';
import { htmlLang } from '../../i18n';
import { ROLE_HOME } from '../../shared/enums';
import type { SessionClaims } from '../../shared/session';
import { LanguagePreference } from '../../features/workspace/LanguagePreference';
import { WorkspaceNav, type WorkspaceNavItem } from '../../features/workspace/WorkspaceNav';
import { NotificationBell } from '../../features/notifications/NotificationBell';
import { SignOutButton } from '../../features/auth/SignOutButton';
import { ScalesMark, Wordmark } from './Logo';
import { SiteFooter } from './SiteFooter';
import { SkipLink } from './SkipLink';

/**
 * Authenticated shell (AGENTS.md §15): top bar with role identity, language
 * preference and sign-out; a role-aware side navigation that becomes a bottom
 * tab bar on mobile. Only destinations that exist for the role are linked —
 * no dead buttons, and the API Manager has no guide access (AGENTS.md §3).
 */
export function WorkspaceShell({
  session,
  locale,
  dict,
  children,
}: {
  session: SessionClaims;
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const home = ROLE_HOME[session.role];

  const navItems: WorkspaceNavItem[] = [
    { href: home, label: dict.workspace.navOverview, kind: 'overview' },
  ];

  if (session.role === 'Curator') {
    navItems.push({
      href: '/curator/guides',
      label: dict.workspace.navCurator,
      kind: 'review',
    });
  }

  if (session.role === 'Citizen') {
    navItems.push({
      href: '/citizen/drafts',
      label: dict.workspace.navDrafts,
      kind: 'draft',
    });
    navItems.push({
      href: '/citizen/chat',
      label: dict.workspace.navChat,
      kind: 'chat',
    });
    navItems.push({
      href: '/citizen/cases',
      label: dict.workspace.navCases,
      kind: 'case',
    });
  }

  if (session.role === 'Lawyer') {
    navItems.push({
      href: '/lawyer/queue',
      label: dict.workspace.navLawyerQueue,
      kind: 'review',
    });
  }

  if (session.role !== 'API Manager') {
    navItems.push({
      href: '/knowledge',
      label: dict.common.knowledgeHub,
      kind: 'book',
    });
  }

  return (
    <div lang={htmlLang(locale)}>
      <SkipLink label={dict.common.skipToContent} />

      <header className="border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-18 w-full max-w-shell items-center justify-between gap-3 px-5 sm:px-8">
          <Link href={home} className="rounded-input" aria-label={dict.common.appName}>
            <span className="sm:hidden">
              <ScalesMark className="h-8 w-8 text-primary" />
            </span>
            <span className="hidden sm:inline">
              <Wordmark />
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguagePreference locale={locale} dict={dict} />
            <NotificationBell locale={locale} dict={dict} />

            <div className="hidden text-right md:block">
              <p className="max-w-[14rem] truncate text-sm font-medium leading-tight text-ink">
                {session.name}
              </p>
              <p className="text-xs text-muted">{dict.roles[session.role]}</p>
            </div>

            <SignOutButton dict={dict} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-shell gap-8 px-5 pb-24 pt-8 sm:px-8 lg:pb-8">
        <WorkspaceNav
          items={navItems}
          homeHref={home}
          label={dict.workspace.navLabel}
          variant="side"
        />

        <main id="main-content" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <WorkspaceNav
        items={navItems}
        homeHref={home}
        label={dict.workspace.navLabel}
        variant="bottom"
      />

      <div className="pb-14 lg:pb-0">
        <SiteFooter dict={dict} />
      </div>
    </div>
  );
}
