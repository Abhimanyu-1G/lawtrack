'use client';

import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';

import { MetricsTab } from './MetricsTab';
import { IntegrationsTab } from './IntegrationsTab';
import type { Dictionary } from '../../i18n';
import type { SessionClaims } from '../../shared/session';
import type { MetricsSummaryDto } from '../../server/modules/metrics/service';
import type { IntegrationsService } from '../../server/modules/integrations/service';

interface ApiManagerTabsProps {
  session: SessionClaims;
  dict: Dictionary;
  initialSummary: MetricsSummaryDto;
  initialIntegrations: Awaited<ReturnType<IntegrationsService['list']>>;
}

export function ApiManagerTabs({ dict, initialSummary, initialIntegrations }: ApiManagerTabsProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'integrations'>('metrics');
  const apiDict = dict.apiManager;

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.workspace.signedInAs.replace('{{role}}', dict.roles['API Manager'])}
          </p>
          <h1 className="mt-2 text-3xl leading-tight">{apiDict.title}</h1>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          label={apiDict.title}
          value={activeTab}
          onChange={(id) => setActiveTab(id as 'metrics' | 'integrations')}
          items={[
            { id: 'metrics', label: apiDict.tabs.metrics },
            { id: 'integrations', label: apiDict.tabs.integrations },
          ]}
        />
      </div>

      <div className="mt-6">
        {activeTab === 'metrics' && <MetricsTab dict={dict} initialSummary={initialSummary} />}
        {activeTab === 'integrations' && <IntegrationsTab dict={dict} initialIntegrations={initialIntegrations} />}
      </div>
    </div>
  );
}