import Link from 'next/link';

import { Badge } from '../../components/ui/Badge';
import { categoryLabel, getDictionary, type Locale } from '../../i18n';
import { ROLE_HOME } from '../../shared/enums';
import { formatGuideDate } from '../knowledge/format';
import {
  caseStatusLabel,
  caseStatusTone,
  formatCaseDate,
  nextHearingLabel,
} from '../cases/format';
import { getCasesService } from '../../server/modules/cases';
import { getGuidesService } from '../../server/modules/guides';
import { requirePageRole } from '../../server/http/pageAuth';
import { AccountCard } from './AccountCard';

/**
 * Citizen home (AGENTS.md §15). It offers the features that exist today — the
 * chatbot, the Knowledge Hub and "continue where you left off" — and no buttons
 * that lead nowhere. Drafts and case tracking get their own cards in later
 * phases.
 */
export async function CitizenHome() {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);
  const lastViewed = await getGuidesService().lastViewed(Number(session.sub));
  const trackedCases = await getCasesService().listForCitizen(Number(session.sub));

  return (
    <div className="max-w-4xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.workspace.signedInAs.replace('{{role}}', dict.roles.Citizen)}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
        {dict.workspace.welcome.replace('{{name}}', session.name)}
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">
        {dict.workspace.citizenIntro}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft">
          <p className="inline-flex w-fit items-center gap-2 rounded-pill bg-primary-tint px-3 py-1 text-xs font-semibold text-primary">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-primary" />
            {dict.workspace.availableNow}
          </p>
          <h2 className="mt-3 text-lg">{dict.workspace.chatCardTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{dict.workspace.chatCardBody}</p>
          <Link
            href="/citizen/chat"
            className="mt-auto inline-flex h-10 w-fit items-center gap-2 rounded-input bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed"
          >
            {dict.workspace.openChat}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>

        <section className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-lg">{dict.workspace.draftsCardTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{dict.workspace.draftsCardBody}</p>
          <Link
            href="/citizen/drafts"
            className="mt-auto inline-flex h-10 w-fit items-center gap-2 rounded-input border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/50 hover:text-primary"
          >
            {dict.workspace.openDrafts}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>

        <section className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-lg">{dict.workspace.browseGuidesTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{dict.workspace.browseGuidesBody}</p>
          <Link
            href={{ pathname: '/knowledge', query: { lang: locale } }}
            className="mt-auto inline-flex h-10 w-fit items-center gap-2 rounded-input border border-line bg-surface px-4 text-sm font-semibold text-ink transition-colors hover:border-primary/50 hover:text-primary"
          >
            {dict.workspace.openKnowledge}
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </section>

        <section className="rounded-card border border-line bg-surface p-6 shadow-soft md:col-span-2">
          <h2 className="text-lg">{dict.workspace.lastViewedTitle}</h2>
          {lastViewed ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {categoryLabel(dict, lastViewed.category)}
              </p>
              <h3 className="mt-1.5 text-base leading-snug">
                <Link
                  href={{ pathname: `/knowledge/${lastViewed.id}`, query: { lang: locale } }}
                  className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {lastViewed.title}
                </Link>
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                {lastViewed.summary.split('\n\n')[0]}
              </p>
              <p className="mt-3 text-xs text-muted">
                {dict.knowledge.updated.replace(
                  '{{date}}',
                  formatGuideDate(lastViewed.lastUpdated, locale),
                )}
              </p>
              <Link
                href={{ pathname: `/knowledge/${lastViewed.id}`, query: { lang: locale } }}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.workspace.continueReading}
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="mt-3">
              <p className="text-sm leading-6 text-muted">{dict.workspace.noLastViewed}</p>
              <Link
                href={{ pathname: '/knowledge', query: { lang: locale } }}
                className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.workspace.openKnowledge}
              </Link>
            </div>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-card border border-line bg-surface p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">{dict.cases.dashboardTitle}</h2>
          <Link
            href="/citizen/cases"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {dict.cases.viewAll}
          </Link>
        </div>
        {trackedCases.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-muted">{dict.cases.dashboardEmptyBody}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {trackedCases.slice(0, 3).map((row) => {
              const label = nextHearingLabel(dict, row.nextHearingDate);
              return (
                <li key={row.id}>
                  <Link
                    href={`/citizen/cases/${row.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-input border border-line px-4 py-3 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {row.cnr} · {row.courtName}
                      </p>
                      <p className="mt-1.5 text-sm text-ink">
                        {row.nextHearingDate
                          ? `${dict.cases.nextHearingLabel}: ${formatCaseDate(
                              row.nextHearingDate,
                              locale,
                            )}`
                          : dict.cases.noNextDate}
                        {label && row.nextHearingDate ? (
                          <span className="ml-2 text-xs text-muted">({label})</span>
                        ) : null}
                      </p>
                    </div>
                    <Badge tone={caseStatusTone(row.status)}>
                      {caseStatusLabel(dict, row.status)}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-4">
        <AccountCard session={session} dict={dict} />
      </div>

      <p className="mt-8 text-xs leading-5 text-muted">{dict.workspace.prototypeNote}</p>
    </div>
  );
}
