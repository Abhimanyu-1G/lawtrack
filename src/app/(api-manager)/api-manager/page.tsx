import { ApiManagerTabs } from '@/features/api-manager/ApiManagerTabs';

import { getMetricsService } from '@/server/modules/metrics';
import { getIntegrationsService } from '@/server/modules/integrations';
import { getDictionary, type Locale } from '@/i18n';
import { ROLE_HOME } from '@/shared/enums';
import { requirePageRole } from '@/server/http/pageAuth';

export const dynamic = 'force-dynamic';

export default async function ApiManagerPage() {
  const session = await requirePageRole('API Manager', ROLE_HOME['API Manager']);
  const locale: Locale = session.language === 'Hindi' ? 'hi' : 'en';
  const dict = getDictionary(locale);

  const [summary, integrations] = await Promise.all([
    getMetricsService().getSummary(7),
    getIntegrationsService().list(),
  ]);

  return (
    <ApiManagerTabs
      session={session}
      dict={dict}
      initialSummary={summary}
      initialIntegrations={integrations}
    />
  );
}