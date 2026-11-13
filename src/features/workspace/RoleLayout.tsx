import type { ReactNode } from 'react';

import { WorkspaceShell } from '../../components/site/WorkspaceShell';
import { getDictionary, type Locale } from '../../i18n';
import { ROLE_HOME, type UserRole } from '../../shared/enums';
import { requirePageRole } from '../../server/http/pageAuth';

/**
 * Shared authoritative role layout. `middleware.ts` may already have redirected
 * by role, but this server check is the one that decides access (AGENTS.md §2).
 */
export async function RoleLayout({ role, children }: { role: UserRole; children: ReactNode }) {
  const home = ROLE_HOME[role];
  const session = await requirePageRole(role, home);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  return (
    <WorkspaceShell session={session} locale={locale} dict={dict}>
      {children}
    </WorkspaceShell>
  );
}
