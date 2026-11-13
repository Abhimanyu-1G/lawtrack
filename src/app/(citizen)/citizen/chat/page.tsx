import { ROLE_HOME } from '@/shared/enums';
import { ChatWorkspace } from '@/features/chat/ChatWorkspace';
import { getDictionary, type Locale } from '@/i18n';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

/**
 * Citizen chatbot (AGENTS.md §8, §15, UC-02). The page is a thin server shell:
 * it authorises the Citizen role and hands the dictionary plus the default
 * session language to the client workspace, which owns all interaction.
 */
export default async function CitizenChatPage() {
  const session = await requirePageRole('Citizen', ROLE_HOME.Citizen);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  return (
    <ChatWorkspace
      locale={locale}
      dict={dict}
      defaultLanguage={session.language === 'Hindi' ? 'Hindi' : 'English'}
    />
  );
}
