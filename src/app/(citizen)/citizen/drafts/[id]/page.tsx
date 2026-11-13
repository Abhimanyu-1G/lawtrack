import { notFound } from 'next/navigation';

import { DraftDetail } from '@/features/drafts/DraftDetail';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

interface DraftDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Client detail shell; the API enforces ownership and hides unapproved text. */
export default async function DraftDetailPage({ params }: DraftDetailPageProps) {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const { id } = await params;
  const draftId = Number(id);
  if (!Number.isInteger(draftId) || draftId < 1) notFound();

  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  return <DraftDetail id={draftId} locale={locale} dict={getDictionary(locale)} />;
}
