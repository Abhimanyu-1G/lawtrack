'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/SelectField';
import { TextField } from '@/components/ui/TextField';
import { type Dictionary } from '@/i18n';
import type { AuditEntryDto } from '@/server/modules/audit/service';
import type { AuditFilter } from '@/server/modules/audit/repo';

interface AuditTabProps {
  dict: Dictionary;
  initialActions: string[];
}

export function AuditTab({ dict, initialActions }: AuditTabProps) {
  const a = dict.admin.audit;
  const [filters, setFilters] = useState<AuditFilter>({
    page: 1,
    pageSize: 20,
  });

  const query = useQuery({
    queryKey: ['admin-audit', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.actorId) params.set('actorId', String(filters.actorId));
      if (filters.action) params.set('action', filters.action);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
      const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load audit log');
      return res.json() as Promise<{ items: AuditEntryDto[]; total: number; page: { page: number; pageSize: number }; actions: string[] }>;
    },
  });

  function handleFilterChange(key: keyof AuditFilter, value: string | number | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  function handleExport() {
    const params = new URLSearchParams({ format: 'csv' });
    if (filters.actorId) params.set('actorId', String(filters.actorId));
    if (filters.action) params.set('action', filters.action);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    window.open(`/api/admin/audit-logs?${params}`, '_blank');
  }

  function clearFilters() {
    setFilters({ page: 1, pageSize: 20 });
  }

  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / Number(filters.pageSize ?? 20)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{a.title}</CardTitle>
          <p className="mt-1 text-sm text-muted">{a.subtitle}</p>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-6 items-end">
            <TextField
              id="audit-filter-actor"
              label={a.actor}
              name="actor"
              placeholder={a.actor}
              value={String(filters.actorId ?? '')}
              onChange={(e) => handleFilterChange('actorId', e.target.value ? Number(e.target.value) : undefined)}
            />
            <SelectField
              id="audit-filter-action"
              label={a.action}
              name="action"
              value={filters.action ?? ''}
              onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
            >
              <option value="">{a.action}</option>
              {initialActions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </SelectField>
            <TextField
              id="audit-filter-from"
              label={a.fromDate}
              name="from"
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => handleFilterChange('from', e.target.value || undefined)}
              placeholder={a.fromDate}
            />
            <TextField
              id="audit-filter-to"
              label={a.toDate}
              name="to"
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => handleFilterChange('to', e.target.value || undefined)}
              placeholder={a.toDate}
            />
            <Button variant="secondary" size="sm" onClick={handleExport} className="h-11">
              {a.exportCsv}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-11">
              {a.clear}
            </Button>
          </div>

          {query.isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse h-12 rounded-input bg-line/70" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      <th className="py-3 px-4">{a.table.time}</th>
                      <th className="py-3 px-4">{a.table.actor}</th>
                      <th className="py-3 px-4">{a.table.role}</th>
                      <th className="py-3 px-4">{a.table.action}</th>
                      <th className="py-3 px-4">{a.table.details}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data?.items.map((row) => (
                      <tr key={row.id} className="border-b border-line/50">
                        <td className="py-3 px-4 text-muted">{row.timestamp.slice(0, 19).replace(' ', 'T')}</td>
                        <td className="py-3 px-4 font-medium">{row.actorName}</td>
                        <td className="py-3 px-4 text-sm capitalize text-muted">{row.actorRole.toLowerCase()}</td>
                        <td className="py-3 px-4 font-mono text-xs">{row.action}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted max-w-xs truncate">
                          {row.details ? JSON.stringify(JSON.parse(row.details)) : '—'}
                        </td>
                      </tr>
                    ))}
                    {(!query.data?.items.length) && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted">{a.noResults}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {a.page.replace('{{page}}', String(filters.page ?? 1)).replace('{{total}}', String(totalPages))}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePageChange(Number(filters.page ?? 1) - 1)}
                      disabled={Number(filters.page ?? 1) <= 1}
                    >
                      ←
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePageChange(Number(filters.page ?? 1) + 1)}
                      disabled={Number(filters.page ?? 1) >= totalPages}
                    >
                      →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}