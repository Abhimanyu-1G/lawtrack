import { getDictionary, type Locale } from '../../i18n';
import { ROLE_HOME, type UserRole } from '../../shared/enums';
import { requirePageRole } from '../../server/http/pageAuth';
import { RoleOverview } from './RoleOverview';

/** Role landing page: re-checks the session, then renders the overview. */
export async function RolePage({ role }: { role: UserRole }) {
  const session = await requirePageRole(role, ROLE_HOME[role]);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';

  return <RoleOverview session={session} dict={getDictionary(locale)} />;
}
