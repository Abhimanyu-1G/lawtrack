'use client';

import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';

import { UsersTab } from './UsersTab';
import { SettingsTab } from './SettingsTab';
import { CategoriesTab } from './CategoriesTab';
import { AuditTab } from './AuditTab';
import type { Dictionary } from '../../i18n';
import type { SessionClaims } from '../../shared/session';
import type { SettingDto } from '../../server/modules/settings/service';
import type { CategoryDto } from '../../server/modules/admin/categories';
import type { AdminUserListDto } from '../../server/modules/admin/service';

interface AdminTabsProps {
  session: SessionClaims;
  dict: Dictionary;
  initialUsers: AdminUserListDto;
  initialSettings: SettingDto[];
  initialCategories: CategoryDto[];
  initialActions: string[];
}

export function AdminTabs({
  dict,
  initialUsers,
  initialSettings,
  initialCategories,
  initialActions,
}: AdminTabsProps) {
  const adminDict = dict.admin;
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {dict.workspace.signedInAs.replace('{{role}}', dict.roles.Administrator)}
          </p>
          <h1 className="mt-2 text-3xl leading-tight">{adminDict.title}</h1>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          label={adminDict.title}
          items={[
            { id: 'users', label: adminDict.tabs.users },
            { id: 'settings', label: adminDict.tabs.settings },
            { id: 'categories', label: adminDict.tabs.categories },
            { id: 'audit', label: adminDict.tabs.audit },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className="mt-6">
        {activeTab === 'users' && <UsersTab dict={dict} initialUsers={initialUsers} />}
        {activeTab === 'settings' && <SettingsTab dict={dict} initialSettings={initialSettings} />}
        {activeTab === 'categories' && <CategoriesTab dict={dict} initialCategories={initialCategories} />}
        {activeTab === 'audit' && <AuditTab dict={dict} initialActions={initialActions} />}
      </div>
    </div>
  );
}