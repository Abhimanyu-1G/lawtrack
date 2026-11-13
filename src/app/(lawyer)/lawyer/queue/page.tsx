import { ReviewQueue } from '@/features/drafts/ReviewQueue';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

/** Lawyer review queue shell. */
export default async function LawyerQueuePage() {
  const session = await requirePageRole('Lawyer', ROLE_HOME.Lawyer);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';

  return <ReviewQueue locale={locale} dict={getDictionary(locale)} />;
}
