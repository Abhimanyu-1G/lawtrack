import { DraftWizard } from '@/features/drafts/DraftWizard';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';
import { getDraftsService } from '@/server/modules/drafts';

export const dynamic = 'force-dynamic';

/** Wizard shell: authorises the role and hands the dictionary to the client. */
export default async function NewDraftPage() {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';

  return (
    <DraftWizard
      locale={locale}
      dict={getDictionary(locale)}
      demo={getDraftsService().demoMode}
      defaultName={session.name}
    />
  );
}
