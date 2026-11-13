import Link from 'next/link';

import { Badge } from '@/components/ui/Badge';
import { buttonClasses } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { draftStatusLabel, draftTypeName, formatDraftDate } from '@/features/drafts/format';
import { statusTone } from '@/features/drafts/types';
import { formatMessage, getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';
import { getDraftsService } from '@/server/modules/drafts';

export const dynamic = 'force-dynamic';

/**
 * Citizen draft list (AGENTS.md §9, §15). Server-rendered from the service, so
 * the first paint needs no client fetch; the detail and wizard pages own their
 * mutations.
 */
export default async function CitizenDraftsPage() {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);
  const drafts = await getDraftsService().listForCitizen(Number(session.sub));

  return (
    <div className="max-w-4xl animate-fade-in">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {dict.drafts.eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl leading-tight sm:text-4xl">{dict.drafts.title}</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-7 text-muted">{dict.drafts.intro}</p>
        </div>
        <Link href="/citizen/drafts/new" className={buttonClasses('primary')}>
          {dict.drafts.newDraft}
        </Link>
      </div>

      <h2 className="mt-8 text-lg">{dict.drafts.listTitle}</h2>

      {drafts.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={dict.drafts.listEmptyTitle}
            body={dict.drafts.listEmptyBody}
            action={
              <Link href="/citizen/drafts/new" className={buttonClasses('primary')}>
                {dict.drafts.newDraft}
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/citizen/drafts/${draft.id}`}
                className="block rounded-card border border-line bg-surface p-5 shadow-soft transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-ink">{draftTypeName(dict, draft.type)}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{draft.preview}</p>
                    <p className="mt-2 text-xs text-muted">
                      {formatMessage(dict.drafts.createdOn, {
                        date: formatDraftDate(draft.createdAt, locale),
                      })}
                      {' · '}
                      {formatMessage(dict.drafts.versionLabel, { version: draft.version })}
                      {draft.rejectionCount > 0
                        ? ` · ${formatMessage(dict.drafts.rejectionCount, { count: draft.rejectionCount })}`
                        : ''}
                    </p>
                  </div>
                  <Badge tone={statusTone(draft.status)}>{draftStatusLabel(dict, draft.status)}</Badge>
                </div>
                <span className="mt-3 inline-flex text-sm font-semibold text-primary">
                  {dict.drafts.openDraft} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs leading-5 text-muted">{dict.common.footerDisclaimer}</p>
    </div>
  );
}
