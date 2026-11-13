import { CaseTracker } from '@/features/cases/CaseTracker';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

/** Citizen case tracker (AGENTS.md §6, §15). The client component owns lookups. */
export default async function CitizenCasesPage() {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  return <CaseTracker locale={locale} dict={getDictionary(locale)} />;
}
