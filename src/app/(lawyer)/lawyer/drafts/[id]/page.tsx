import { notFound } from 'next/navigation';

import { ReviewWorkspace } from '@/features/drafts/ReviewWorkspace';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

/** Lawyer review shell; opening the page claims the draft for 15 minutes. */
export default async function LawyerReviewPage({ params }: ReviewPageProps) {
  const session = await requirePageRole('Lawyer', ROLE_HOME.Lawyer);
  const { id } = await params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId < 1) notFound();

  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  return <ReviewWorkspace id={draftId} locale={locale} dict={getDictionary(locale)} />;
}
