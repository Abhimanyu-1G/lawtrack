import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PrintButton } from '@/features/drafts/PrintButton';
import { draftTypeName, formatDraftDate, formatDraftDateTime } from '@/features/drafts/format';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';
import { getDraftsService } from '@/server/modules/drafts';

export const dynamic = 'force-dynamic';

interface PrintDraftPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Standalone print view for an approved draft (AGENTS.md §9). It sits outside
 * the workspace shell so `window.print()` produces only the document. The
 * browser's text shaping renders Devanagari accurately — the authoritative
 * Hindi rendering referenced by D-48.
 */
export default async function PrintDraftPage({ params }: PrintDraftPageProps) {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const { id } = await params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId < 1) notFound();

  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  let draft;
  try {
    draft = await getDraftsService().getForCitizen(Number(session.sub), draftId, locale);
  } catch {
    notFound();
  }

  if (draft.status !== 'Approved' || !draft.generatedText) {
    redirect(`/citizen/drafts/${draftId}`);
  }

  return (
    <div className="min-h-screen bg-white text-ink print:bg-white">
      <div className="mx-auto max-w-[70ch] px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href={`/citizen/drafts/${draftId}`}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            ← {dict.drafts.backToDrafts}
          </Link>
          <PrintButton label={dict.knowledge.print} />
        </div>

        <header className="border-b border-line pb-4">
          <p className="font-serif text-xl text-ink">{dict.common.appName}</p>
          <p className="mt-1 text-sm text-muted">{draftTypeName(dict, draft.type)}</p>
        </header>

        <article className="mt-8 whitespace-pre-wrap break-words font-sans text-[0.95rem] leading-8 text-ink">
          {draft.generatedText}
        </article>

        <footer className="mt-10 border-t border-line pt-4 text-xs leading-5 text-muted">
          <p>
            {dict.common.appName} · #{draft.id} · {dict.drafts.versionLabel.replace('{{version}}', String(draft.version))}
            {draft.approval
              ? ` · ${dict.drafts.statusApproved}: ${draft.approval.lawyerName}, ${formatDraftDate(
                  draft.approval.approvedAt,
                  locale,
                )}`
              : ''}
          </p>
          <p className="mt-1">
            {formatDraftDateTime(draft.createdAt, locale)} · {dict.drafts.approvedTitle}
          </p>
          <p className="mt-3">{dict.common.footerDisclaimer}</p>
        </footer>
      </div>
    </div>
  );
}
