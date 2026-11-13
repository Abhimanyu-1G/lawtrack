'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { TextAreaField } from '@/components/ui/TextAreaField';
import { TextField } from '@/components/ui/TextField';
import { formatMessage, type Dictionary } from '@/i18n';
import { apiRequest } from '@/features/auth/api';

interface IntegrationDto {
  id: number;
  managerId: number;
  serviceName: string;
  status: string;
  lastSyncTime: string | null;
  errorCount: number;
}

interface IntegrationsTabProps {
  dict: Dictionary;
  initialIntegrations: IntegrationDto[];
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  Healthy: 'success',
  Degraded: 'warning',
  Down: 'danger',
};

const NOTICE_CLASSES: Record<'success' | 'warning' | 'danger', string> = {
  success: 'border-success/30 bg-success-tint text-success',
  warning: 'border-warning/30 bg-warning-tint text-warning',
  danger: 'border-danger/30 bg-danger-tint text-danger',
};

export function IntegrationsTab({ dict, initialIntegrations }: IntegrationsTabProps) {
  const i = dict.apiManager.integrations;
  const queryClient = useQueryClient();
  const [logsModal, setLogsModal] = useState<{ open: boolean; integration: IntegrationDto | null }>({ open: false, integration: null });
  const [indiaCodeModal, setIndiaCodeModal] = useState(false);
  const [indiaCodeCategory, setIndiaCodeCategory] = useState('');
  const [indiaCodeSummary, setIndiaCodeSummary] = useState('');
  const [indiaCodeAct, setIndiaCodeAct] = useState('');
  const [indiaCodeEffective, setIndiaCodeEffective] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'danger'; text: string } | null>(null);

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const res = await fetch('/api/integrations', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load integrations');
      return res.json() as Promise<{ integrations: IntegrationDto[] }>;
    },
    initialData: { integrations: initialIntegrations },
  });

  const checkMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<{ integration: IntegrationDto }>(`/api/integrations/${id}/check`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['integrations'], (old: { integrations: IntegrationDto[] } | undefined) => ({
        integrations: old?.integrations.map((int) => (int.id === data.integration.id ? data.integration : int)) ?? [],
      }));
      setNotice({ tone: 'success', text: formatMessage(dict.apiManager.integrations.check, { service: data.integration.serviceName }) });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<{ integration: IntegrationDto }>(`/api/integrations/${id}/retry`, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['integrations'], (old: { integrations: IntegrationDto[] } | undefined) => ({
        integrations: old?.integrations.map((int) => (int.id === data.integration.id ? data.integration : int)) ?? [],
      }));
      setNotice({ tone: 'success', text: formatMessage(dict.apiManager.integrations.retry, { service: data.integration.serviceName }) });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const simulateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest<{ outage: boolean }>('/api/integrations/1/simulate', {
        method: 'POST',
        body: { enabled },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setNotice({ tone: data.outage ? 'warning' : 'success', text: data.outage ? 'eCourts outage simulated' : 'eCourts outage cleared' });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const logsQuery = useQuery({
    queryKey: ['integration-logs', logsModal.integration?.id],
    queryFn: async () => {
      if (!logsModal.integration) return { logs: [] };
      const res = await fetch(`/api/integrations/${logsModal.integration.id}/logs`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load logs');
      return res.json() as Promise<{ logs: { logId: number; action: string; details: string | null; timestamp: string }[] }>;
    },
    enabled: !!logsModal.integration,
  });

  const jobsMutation = useMutation({
    mutationFn: async (job: string) => {
      return apiRequest<{ job: string; ok: boolean }>('/api/jobs/run', {
        method: 'POST',
        body: { job },
      });
    },
    onSuccess: (data) => {
      setNotice({ tone: data.ok ? 'success' : 'danger', text: `Job ${data.job} ${data.ok ? 'completed' : 'failed'}` });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const indiaCodeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ flaggedGuides: number; notifiedCurators: number }>('/api/integrations/indiacode/webhook-simulate', {
        method: 'POST',
        body: { category: indiaCodeCategory, change_summary: indiaCodeSummary, act_name: indiaCodeAct, effective_from: indiaCodeEffective },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setNotice({ tone: 'success', text: `Flagged ${data.flaggedGuides} guides, notified ${data.notifiedCurators} curators` });
      setIndiaCodeModal(false);
      setIndiaCodeCategory('');
      setIndiaCodeSummary('');
      setIndiaCodeAct('');
      setIndiaCodeEffective('');
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={`rounded-input border px-4 py-3 text-sm leading-6 ${NOTICE_CLASSES[notice.tone]}`}
          role="alert"
        >
          {notice.text}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{i.title}</CardTitle>
          <p className="mt-1 text-sm text-muted">{i.subtitle}</p>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="py-3 px-4">{i.table.service}</th>
                  <th className="py-3 px-4">{i.table.status}</th>
                  <th className="py-3 px-4">{i.table.lastSync}</th>
                  <th className="py-3 px-4">{i.table.errors}</th>
                  <th className="py-3 px-4">{i.table.actions}</th>
                </tr>
              </thead>
              <tbody>
                {integrationsQuery.data?.integrations.map((int) => (
                  <tr key={int.id} className="border-b border-line/50">
                    <td className="py-3 px-4 font-medium">{int.serviceName}</td>
                    <td className="py-3 px-4">
                      <Badge tone={STATUS_TONES[int.status] ?? 'neutral'}>{int.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted">
                      {int.lastSyncTime ? int.lastSyncTime.slice(0, 19).replace(' ', 'T') : '—'}
                    </td>
                    <td className={`py-3 px-4 font-mono text-sm ${int.errorCount > 0 ? 'text-danger' : 'text-muted'}`}>{int.errorCount}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => checkMutation.mutate(int.id)} disabled={checkMutation.isPending}>
                          {i.check}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => retryMutation.mutate(int.id)} disabled={retryMutation.isPending}>
                          {i.retry}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setLogsModal({ open: true, integration: int })}>
                          {i.logs}
                        </Button>
                        {int.id === 1 && (
                          <Button
                            size="sm"
                            variant={int.status === 'Down' ? 'danger' : 'ghost'}
                            onClick={() => simulateMutation.mutate(int.status !== 'Down')}
                          >
                            {int.status === 'Down' ? i.simulateOutageEnabled : i.simulateOutage}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{i.jobTitle}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-4">
            {Object.entries(i.jobs).map(([job, label]) => (
              <Button
                key={job}
                variant="secondary"
                onClick={() => jobsMutation.mutate(job)}
                disabled={jobsMutation.isPending}
              >
                {jobsMutation.variables === job && jobsMutation.isPending ? '…' : `${i.runJob} ${label}`}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{i.indiaCodeTitle}</CardTitle>
          <p className="mt-1 text-sm text-muted">{i.indiaCodeDesc}</p>
        </CardHeader>
        <CardBody>
          <Button variant="secondary" onClick={() => setIndiaCodeModal(true)}>
            {i.indiaCodeButton}
          </Button>
        </CardBody>
      </Card>

      <Modal open={logsModal.open} onClose={() => setLogsModal({ open: false, integration: null })} title={`${i.logs}: ${logsModal.integration?.serviceName}`}>
        {logsQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {[...Array(5)].map((_, i) => <div key={i} className="animate-pulse h-10 rounded-input bg-line/70" />)}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {logsQuery.data?.logs.length ? (
              logsQuery.data.logs.map((log) => (
                <div key={log.logId} className="rounded-input border border-line p-3 text-xs font-mono">
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{log.action}</span>
                    <span className="text-muted">{log.timestamp.slice(0, 19).replace(' ', 'T')}</span>
                  </div>
                  {log.details && <pre className="mt-1 whitespace-pre-wrap text-muted">{JSON.stringify(JSON.parse(log.details), null, 2)}</pre>}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">{i.noLogs}</p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={indiaCodeModal} onClose={() => setIndiaCodeModal(false)} title={i.indiaCodeButton}>
        <div className="space-y-4">
          <TextField
            id="indiacode-category"
            name="category"
            label={dict.admin.validation.category}
            required
            value={indiaCodeCategory}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndiaCodeCategory(e.target.value)}
          />
          <TextField
            id="indiacode-act-name"
            name="act_name"
            label={dict.admin.validation.actName}
            required
            value={indiaCodeAct}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndiaCodeAct(e.target.value)}
          />
          <TextAreaField
            id="indiacode-change-summary"
            name="change_summary"
            label={dict.admin.validation.changeSummary}
            required
            value={indiaCodeSummary}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIndiaCodeSummary(e.target.value)}
            rows={3}
          />
          <TextField
            id="indiacode-effective-from"
            name="effective_from"
            label={dict.admin.validation.effectiveFrom}
            type="date"
            required
            value={indiaCodeEffective}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIndiaCodeEffective(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIndiaCodeModal(false)}>
              {dict.common.cancel}
            </Button>
            <Button onClick={() => indiaCodeMutation.mutate()} disabled={indiaCodeMutation.isPending}>
              {indiaCodeMutation.isPending ? dict.common.saving : dict.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}