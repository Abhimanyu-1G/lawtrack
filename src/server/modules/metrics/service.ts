import 'server-only';

import type { Repositories } from '../../db/repositories';
import { toUtcTimestamp, type Clock } from '../../lib/clock';

/**
 * Platform metrics (AGENTS.md §14).
 *
 * Every figure comes from rows the product already writes — `Metric_Event`,
 * `Draft_Review`, `Draft` and the audit trail — so the dashboard cannot drift
 * from reality. Each metric reports its value, the Lab-7 target, a pass /
 * at-risk / fail verdict and a daily series for the sparkline; a metric with no
 * rows is `no-data` instead of a misleading zero.
 */

export type MetricKey =
  | 'grounding'
  | 'chatLatency'
  | 'firstPassApproval'
  | 'regenerationCycles'
  | 'reviewTurnaround'
  | 'cnrLookup'
  | 'syncSuccess'
  | 'validationTurnaround'
  | 'csat'
  | 'availability';

export type MetricUnit = 'percent' | 'ms' | 'hours' | 'rating' | 'count';

export type MetricStatus = 'pass' | 'at-risk' | 'fail' | 'no-data';

export type MetricComparator = 'gte' | 'lte';

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricDto {
  key: MetricKey;
  value: number | null;
  target: number;
  comparator: MetricComparator;
  unit: MetricUnit;
  status: MetricStatus;
  /** Number of underlying rows, so the UI can explain sparse data. */
  samples: number;
  series: MetricPoint[];
}

export interface MetricsSummaryDto {
  rangeDays: 7 | 30;
  from: string;
  to: string;
  generatedAt: string;
  metrics: MetricDto[];
}

export interface MetricsService {
  getSummary(rangeDays?: number): Promise<MetricsSummaryDto>;
}

interface Point {
  at: string;
  value: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dailySeries(points: Point[]): MetricPoint[] {
  const buckets = new Map<string, number[]>();
  for (const point of points) {
    const date = point.at.slice(0, 10);
    const bucket = buckets.get(date);
    if (bucket) bucket.push(point.value);
    else buckets.set(date, [point.value]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, values]) => ({ date, value: round(mean(values) ?? 0, 2) }));
}

/** Relative margin for the amber state: 10 % short of target is "at risk". */
function statusOf(
  value: number | null,
  target: number,
  comparator: MetricComparator,
): MetricStatus {
  if (value === null) return 'no-data';
  if (comparator === 'gte') {
    if (value >= target) return 'pass';
    return value >= target * 0.9 ? 'at-risk' : 'fail';
  }
  if (value <= target) return 'pass';
  return value <= target * 1.1 ? 'at-risk' : 'fail';
}

function build(input: {
  key: MetricKey;
  unit: MetricUnit;
  target: number;
  comparator: MetricComparator;
  value: number | null;
  points: Point[];
  samples: number;
}): MetricDto {
  return {
    key: input.key,
    value: input.value === null ? null : round(input.value, 2),
    target: input.target,
    comparator: input.comparator,
    unit: input.unit,
    status: statusOf(input.value, input.target, input.comparator),
    samples: input.samples,
    series: dailySeries(input.points),
  };
}

/** Share of 0/1 rows that are 1, as a percentage. */
function share(points: Point[]): number | null {
  if (points.length === 0) return null;
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return (total / points.length) * 100;
}

function parseGuideId(details: string | null): number | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const guideId = (parsed as Record<string, unknown>).guideId;
    return typeof guideId === 'number' ? guideId : null;
  } catch {
    return null;
  }
}

function hoursBetween(from: string, to: string): number | null {
  const start = Date.parse(`${from.replace(' ', 'T')}Z`);
  const end = Date.parse(`${to.replace(' ', 'T')}Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return (end - start) / 3_600_000;
}

export function createMetricsService(options: {
  repos: Repositories;
  clock: Clock;
}): MetricsService {
  const { repos, clock } = options;

  return {
    async getSummary(rangeDays = 7) {
      const range: 7 | 30 = rangeDays === 30 ? 30 : 7;
      const now = clock.now();
      const since = toUtcTimestamp(new Date(now.getTime() - range * 86_400_000));

      const [
        latencyRows,
        groundedRows,
        csatRows,
        availabilityRows,
        syncRows,
        lookupRows,
        regenerationRows,
        reviewRows,
        draftCount,
        guideAudit,
      ] = await Promise.all([
        repos.metrics.listSince('chat_latency_ms', since),
        repos.metrics.listSince('chat_grounded', since),
        repos.metrics.listSince('chat_csat', since),
        repos.metrics.listSince('availability', since),
        repos.metrics.listSince('case_sync', since),
        repos.metrics.listSince('case_lookup_ms', since),
        repos.metrics.listSince('draft_regenerated', since),
        repos.metrics.reviewsSince(since),
        repos.metrics.draftCountSince(since),
        repos.audit.listByActions(['GUIDE_FLAGGED', 'GUIDE_VALIDATED'], since),
      ]);

      // ---- chat -----------------------------------------------------------
      const latencyPoints: Point[] = latencyRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value),
      }));
      const groundedPoints: Point[] = groundedRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value) === 1 ? 1 : 0,
      }));
      const csatPoints: Point[] = csatRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value),
      }));

      // ---- drafts ---------------------------------------------------------
      const firstReview = new Map<number, { at: string; decision: string }>();
      for (const row of reviewRows) {
        if (!firstReview.has(row.draft_id)) {
          firstReview.set(row.draft_id, { at: row.reviewed_at, decision: row.decision });
        }
      }
      const firstPassPoints: Point[] = [...firstReview.values()].map((review) => ({
        at: review.at,
        value: review.decision === 'Approved' ? 1 : 0,
      }));

      const turnaroundPoints: Point[] = [];
      for (const row of reviewRows) {
        const hours = hoursBetween(row.created_at, row.reviewed_at);
        if (hours !== null) turnaroundPoints.push({ at: row.reviewed_at, value: hours });
      }

      const regenerations = regenerationRows.reduce(
        (sum, row) => sum + (Number(row.value) || 0),
        0,
      );
      const regenerationDenominator = Math.max(firstReview.size, draftCount);
      const regenerationPoints: Point[] = regenerationRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value) || 0,
      }));

      // ---- cases ----------------------------------------------------------
      const syncPoints: Point[] = syncRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value) === 1 ? 1 : 0,
      }));
      const lookupPoints: Point[] = lookupRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value),
      }));

      // ---- content validation --------------------------------------------
      const flaggedAt = new Map<number, string>();
      const validationPoints: Point[] = [];
      for (const row of guideAudit) {
        const guideId = parseGuideId(row.details);
        if (guideId === null) continue;
        if (row.action === 'GUIDE_FLAGGED') {
          flaggedAt.set(guideId, row.timestamp);
          continue;
        }
        const flagged = flaggedAt.get(guideId);
        if (!flagged) continue;
        const hours = hoursBetween(flagged, row.timestamp);
        if (hours !== null) validationPoints.push({ at: row.timestamp, value: hours });
      }

      const availabilityPoints: Point[] = availabilityRows.map((row) => ({
        at: row.created_at,
        value: Number(row.value) === 1 ? 1 : 0,
      }));

      const metrics: MetricDto[] = [
        build({
          key: 'grounding',
          unit: 'percent',
          target: 95,
          comparator: 'gte',
          value: share(groundedPoints),
          points: groundedPoints,
          samples: groundedPoints.length,
        }),
        build({
          key: 'chatLatency',
          unit: 'ms',
          target: 4000,
          comparator: 'lte',
          value: mean(latencyPoints.map((point) => point.value)),
          points: latencyPoints,
          samples: latencyPoints.length,
        }),
        build({
          key: 'firstPassApproval',
          unit: 'percent',
          target: 70,
          comparator: 'gte',
          value: share(firstPassPoints),
          points: firstPassPoints,
          samples: firstPassPoints.length,
        }),
        build({
          key: 'regenerationCycles',
          unit: 'count',
          target: 1.5,
          comparator: 'lte',
          value: regenerationDenominator > 0 ? regenerations / regenerationDenominator : null,
          points: regenerationPoints,
          samples: regenerationRows.length,
        }),
        build({
          key: 'reviewTurnaround',
          unit: 'hours',
          target: 24,
          comparator: 'lte',
          value: mean(turnaroundPoints.map((point) => point.value)),
          points: turnaroundPoints,
          samples: turnaroundPoints.length,
        }),
        build({
          key: 'cnrLookup',
          unit: 'ms',
          target: 5000,
          comparator: 'lte',
          value: mean(lookupPoints.map((point) => point.value)),
          points: lookupPoints,
          samples: lookupPoints.length,
        }),
        build({
          key: 'syncSuccess',
          unit: 'percent',
          target: 98,
          comparator: 'gte',
          value: share(syncPoints),
          points: syncPoints,
          samples: syncPoints.length,
        }),
        build({
          key: 'validationTurnaround',
          unit: 'hours',
          target: 48,
          comparator: 'lte',
          value: mean(validationPoints.map((point) => point.value)),
          points: validationPoints,
          samples: validationPoints.length,
        }),
        build({
          key: 'csat',
          unit: 'rating',
          target: 4,
          comparator: 'gte',
          value: mean(csatPoints.map((point) => point.value)),
          points: csatPoints,
          samples: csatPoints.length,
        }),
        build({
          key: 'availability',
          unit: 'percent',
          target: 99.5,
          comparator: 'gte',
          value: share(availabilityPoints),
          points: availabilityPoints,
          samples: availabilityPoints.length,
        }),
      ];

      return {
        rangeDays: range,
        from: since,
        to: clock.nowIso(),
        generatedAt: clock.nowIso(),
        metrics,
      };
    },
  };
}
