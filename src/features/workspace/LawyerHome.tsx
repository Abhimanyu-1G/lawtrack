import Link from 'next/link';

import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { AvailabilitySwitch } from '../../features/drafts/AvailabilitySwitch';
import { formatDraftDateTime } from '../../features/drafts/format';
import { AccountCard } from '../../features/workspace/AccountCard';
import { formatMessage, getDictionary, type Locale } from '../../i18n';
import { ROLE_HOME } from '../../shared/enums';
import { requirePageRole } from '../../server/http/pageAuth';
import { getChatService } from '../../server/modules/chat';
import { getDraftsService } from '../../server/modules/drafts';
import { createRepositories } from '../../server/db/repositories';
import { getDb } from '../../server/db/client';

export const dynamic = 'force-dynamic';

/**
 * Lawyer home (AGENTS.md §15): the shared queue count, chatbot help requests,
 * and the availability switch that decides whether new help requests reach
 * this lawyer.
 */
export async function LawyerHome() {
  const session = await requirePageRole('Lawyer', ROLE_HOME.Lawyer);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  const [queue, helpRequests, lawyerProfile] = await Promise.all([
    getDraftsService().queue(Number(session.sub)),
    getChatService().helpRequests(Number(session.sub)),
    createRepositories(getDb()).users.findLawyerProfile(Number(session.sub)),
  ]);

  return (
    <div className="max-w-4xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {formatMessage(dict.workspace.signedInAs, { role: dict.roles.Lawyer })}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">
        {formatMessage(dict.workspace.welcome, { name: session.name })}
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">
        {dict.workspace.nextLawyer}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg">{dict.workspace.lawyerQueueCardTitle}</h2>
            <Badge tone={queue.length > 0 ? 'warning' : 'success'}>{queue.length}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">{dict.workspace.lawyerQueueCardBody}</p>
          <p className="mt-3 text-sm text-muted">{dict.drafts.queueIntro}</p>
          <Link href="/lawyer/queue" className={`${buttonClasses('primary')} mt-auto w-fit`}>
            {dict.workspace.openQueue}
          </Link>
        </section>

        <section className="rounded-card border border-line bg-surface p-6 shadow-soft">
          <h2 className="text-lg">{dict.drafts.statusLabel}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{dict.drafts.helpRequestsIntro}</p>
          <div className="mt-4">
            <AvailabilitySwitch
              initial={lawyerProfile?.status ?? 'Available'}
              locale={locale}
              dict={dict}
            />
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-6 shadow-soft md:col-span-2">
          <h2 className="text-lg">{dict.workspace.helpRequestsTitle}</h2>
          {helpRequests.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-muted">{dict.drafts.helpRequestsEmpty}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {helpRequests.map((request) => (
                <li key={`${request.sessionId}-${request.requestedAt}`} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{request.citizenName}</p>
                    <p className="text-xs text-muted">
                      {formatMessage(dict.drafts.helpRequestedAt, {
                        date: formatDraftDateTime(request.requestedAt, locale),
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">{request.preview}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="md:col-span-2">
          <AccountCard session={session} dict={dict} />
        </div>
      </div>

      <p className="mt-8 text-xs leading-5 text-muted">{dict.workspace.prototypeNote}</p>
    </div>
  );
}
