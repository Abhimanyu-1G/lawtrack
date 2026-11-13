'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SelectField } from '@/components/ui/SelectField';
import { type Dictionary } from '@/i18n';
import { apiRequest } from '@/features/auth/api';
import type { MetricDto, MetricsSummaryDto } from '@/server/modules/metrics/service';

interface MetricsTabProps {
  dict: Dictionary;
  initialSummary: MetricsSummaryDto;
}

const METRIC_KEYS: MetricDto['key'][] = [
  'grounding',
  'chatLatency',
  'firstPassApproval',
  'regenerationCycles',
  'reviewTurnaround',
  'cnrLookup',
  'syncSuccess',
  'validationTurnaround',
  'csat',
  'availability',
];

function statusBadge(dict: Dictionary, status: MetricDto['status']) {
  const labels = dict.apiManager.metrics.status;
  const tones: Record<MetricDto['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
    pass: 'success',
    'at-risk': 'warning',
    fail: 'danger',
    'no-data': 'neutral',
  };
  return <Badge tone={tones[status]}>{labels[status]}</Badge>;
}

function formatValue(metric: MetricDto, dict: Dictionary) {
  const unitLabels = dict.apiManager.metrics.units;
  if (metric.value === null) return <span className="text-muted">—</span>;
  const unit = unitLabels[metric.unit];
  const value = metric.value.toLocaleString(undefined, { maximumFractionDigits: metric.unit === 'percent' ? 1 : 2 });
  return <span className="font-mono text-lg">{value} <span className="text-sm font-normal text-muted">{unit}</span></span>;
}

function sparkline(points: MetricDto['series']) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const stepX = width / (points.length - 1);
  const path = points
    .map((point, i) => {
      const x = i * stepX;
      const y = height - ((point.value - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-8 text-primary" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MetricsTab({ dict, initialSummary }: MetricsTabProps) {
  const m = dict.apiManager.metrics;
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['metrics-summary', rangeDays],
    queryFn: async () => {
      const res = await fetch(`/api/metrics/summary?range=${rangeDays}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load metrics');
      return res.json() as Promise<{ summary: MetricsSummaryDto }>;
    },
    initialData: { summary: initialSummary },
  });

  const loadDemoMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ ok: boolean }>('/api/admin/seed-demo-metrics', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
      setNotice({ tone: 'success', text: m.loadedDemoToast });
    },
    onError: (error: Error) => setNotice({ tone: 'danger', text: error.message }),
  });

  const summary = summaryQuery.data?.summary;
  if (!summary) return <div className="animate-pulse h-64" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle as="h2">{m.title}</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <SelectField
            id="range"
            name="range"
            label={m.rangeLabel}
            value={String(rangeDays)}
            onChange={(e) => setRangeDays(Number(e.target.value) as 7 | 30)}
          >
            <option value="7">{m.range7}</option>
            <option value="30">{m.range30}</option>
          </SelectField>
          <Button variant="secondary" size="sm" onClick={() => loadDemoMutation.mutate()}>
            {m.loadDemo}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['metrics-summary'] })}>
            {m.refresh}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">{m.subtitle}</p>

      {notice ? (
        <div className="rounded-input border border-success/30 bg-success-tint px-4 py-3 text-sm leading-6 text-success" role="alert">
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {METRIC_KEYS.map((key) => {
          const metric = summary.metrics.find((m) => m.key === key);
          if (!metric) return null;
          const label = m.cards[key];
          return (
            <Card key={key} className="relative overflow-hidden">
              <CardBody className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
                <div className="flex items-baseline justify-between">
                  {formatValue(metric, dict)}
                  {statusBadge(dict, metric.status)}
                </div>
                {sparkline(metric.series)}
                <p className="text-xs text-muted">{metric.samples} samples</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {summary.metrics.every((m) => m.samples === 0) && (
        <EmptyState
          title={m.title}
          body="No metric data yet. Generate some activity or press “Load demo metrics” to populate the dashboard."
          action={
            <Button onClick={() => loadDemoMutation.mutate()}>{m.loadDemo}</Button>
          }
        />
      )}
    </div>
  );
}