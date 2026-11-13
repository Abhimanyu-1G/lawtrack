import Link from 'next/link';

import { getDictionary, type Locale } from '../../i18n';
import { ROLE_HOME } from '../../shared/enums';
import { getGuidesService } from '../../server/modules/guides';
import { requirePageRole } from '../../server/http/pageAuth';
import { AccountCard } from './AccountCard';

/**
 * Curator home (AGENTS.md §15): the current state of the knowledge base with a
 * single, real route into the console. No fabricated activity figures — the
 * numbers come straight from `Legal_Guide`.
 */
export async function CuratorHome() {
  const session = await requirePageRole('Curator', ROLE_HOME.Curator);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);
  const counts = await getGuidesService().statusCounts();

  const stats = [
    { label: dict.curator.statusDraft, count: counts.Draft },
    { label: dict.curator.statusRequires, count: counts['Requires AI Update'] },
    { label: dict.curator.statusValid, count: counts.Valid },
  ];

  return (
    <div className="max-w-4xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.workspace.signedInAs.replace('{{role}}', dict.roles.Curator)}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
        {dict.workspace.welcome.replace('{{name}}', session.name)}
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">
        {dict.workspace.curatorIntro}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-lg">{dict.workspace.curatorWorkTitle}</h2>
          <ul className="mt-4 divide-y divide-line">
            {stats.map((stat) => (
              <li key={stat.label} className="flex items-center justify-between gap-4 py-3">
                <p className="text-sm font-medium text-ink">{stat.label}</p>
                <span className="font-serif text-2xl font-semibold tabular-nums text-primary">
                  {stat.count}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/curator/guides"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-input bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-pressed"
          >
            {dict.workspace.openCuratorConsole}
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

        <AccountCard session={session} dict={dict} />
      </div>

      <p className="mt-8 text-xs leading-5 text-muted">{dict.workspace.prototypeNote}</p>
    </div>
  );
}
