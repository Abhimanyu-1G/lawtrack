import { notFound } from 'next/navigation';

import { CaseDetail } from '@/features/cases/CaseDetail';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Client detail shell; the API enforces that the citizen tracks this case. */
export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const { id } = await params;
  const caseId = Number(id);
  if (!Number.isInteger(caseId) || caseId < 1) notFound();

  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  return <CaseDetail id={caseId} locale={locale} dict={getDictionary(locale)} />;
}
