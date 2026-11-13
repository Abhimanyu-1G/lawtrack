import { AdminTabs } from '@/features/admin/AdminTabs';

import { getAdminUserService } from '@/server/modules/admin';
import { getAdminCategoriesService } from '@/server/modules/admin';
import { getSettingsService } from '@/server/modules/settings';
import { getAuditService } from '@/server/modules/audit';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await requirePageRole('Administrator', ROLE_HOME.Administrator);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  const [users, settings, categories] = await Promise.all([
    getAdminUserService().list({}),
    getSettingsService().list(),
    getAdminCategoriesService().list(),
  ]);

  const actions = await getAuditService().actions();

  return (
    <AdminTabs
      session={session}
      dict={dict}
      initialUsers={users}
      initialSettings={settings}
      initialCategories={categories}
      initialActions={actions}
    />
  );
}