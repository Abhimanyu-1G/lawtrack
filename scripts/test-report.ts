import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Builds the deliverable test report from Vitest's JSON output.
 *
 * Output:
 *   test-report/test-report.csv  (module,id,description,result,duration_ms)
 *   test-report/summary.md       (per-module Pass/Fail/Pending/Total + coverage)
 *
 * Official IDs (AGENTS.md §17) are verified against tests/official-ids.json.
 * The check is skipped until that manifest exists, so the report can be built
 * from the very first phase of the project.
 */

interface VitestAssertion {
  title?: string;
  fullName?: string;
  status?: string;
  duration?: number | null;
}

interface VitestFileResult {
  name?: string;
  assertionResults?: VitestAssertion[];
}

interface VitestJson {
  testResults?: VitestFileResult[];
}

interface ReportRow {
  module: string;
  id: string;
  description: string;
  result: 'Pass' | 'Fail' | 'Pending';
  durationMs: number;
}

const INPUT =
  process.env.VITEST_JSON_PATH ||
  (existsSync(path.join(os.tmpdir(), 'vitest.json'))
    ? path.join(os.tmpdir(), 'vitest.json')
    : path.join('test-report', 'vitest.json'));
const CSV_PATH = path.join('test-report', 'test-report.csv');
const SUMMARY_PATH = path.join('test-report', 'summary.md');
const MANIFEST_PATH = path.join('tests', 'official-ids.json');

const MODULE_BY_PREFIX: Record<string, string> = {
  USR: 'User',
  DFT: 'Legal Draft',
  CSE: 'Court Case',
};

const MODULE_ORDER = ['User', 'Legal Draft', 'Court Case', 'Other'];

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

function toResult(status: string | undefined): ReportRow['result'] {
  if (status === 'passed') return 'Pass';
  if (status === 'failed') return 'Fail';
  return 'Pending';
}

function moduleFromFile(fileName: string): string {
  const normalised = fileName.replaceAll('\\', '/');
  if (normalised.includes('/unit/')) return 'Unit';
  if (normalised.includes('/api/')) return 'API';
  if (normalised.includes('/e2e/')) return 'E2E';
  return 'Other';
}

function escapeCsv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildRows(json: VitestJson): ReportRow[] {
  const rows: ReportRow[] = [];

  for (const file of json.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      // `fullName` is prefixed with the describe title, so the official ID is
      // read from the test's own title (AGENTS.md §17).
      const title = assertion.title ?? assertion.fullName ?? '(untitled test)';
      const description = assertion.fullName ?? title;
      const match = /^(UT_[A-Z]{3}_\d{2,3})\b/.exec(title);

      rows.push({
        module: match
          ? (MODULE_BY_PREFIX[match[1]!.slice(3, 6)] ?? moduleFromFile(file.name ?? ''))
          : moduleFromFile(file.name ?? ''),
        id: match?.[1] ?? '',
        description,
        result: toResult(assertion.status),
        durationMs: Math.round(assertion.duration ?? 0),
      });
    }
  }

  return rows;
}

function verifyOfficialIds(rows: ReportRow[]): string[] {
  if (!existsSync(MANIFEST_PATH)) return [];

  const manifest = readJson<Record<string, number[]>>(MANIFEST_PATH);
  const present = new Set(rows.map((row) => row.id).filter(Boolean));
  const missing: string[] = [];

  for (const [prefix, ids] of Object.entries(manifest)) {
    for (const id of ids) {
      const official = `${prefix}_${String(id).padStart(2, '0')}`;
      if (!present.has(official)) missing.push(official);
    }
  }

  return missing;
}

function summarise(rows: ReportRow[]): string {
  const modules = [...new Set(rows.map((row) => row.module))].sort(
    (a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b),
  );

  const totals = { pass: 0, fail: 0, pending: 0, total: 0 };
  const lines: string[] = [
    '# LawTrack test report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Module | Pass | Fail | Pending | Total | Test coverage | Successful coverage |',
    '|---|---:|---:|---:|---:|---:|---:|',
  ];

  for (const moduleName of modules) {
    const moduleRows = rows.filter((row) => row.module === moduleName);
    const pass = moduleRows.filter((row) => row.result === 'Pass').length;
    const fail = moduleRows.filter((row) => row.result === 'Fail').length;
    const pending = moduleRows.filter((row) => row.result === 'Pending').length;
    const total = moduleRows.length;

    totals.pass += pass;
    totals.fail += fail;
    totals.pending += pending;
    totals.total += total;

    const coverage = total === 0 ? 0 : ((pass + fail) / total) * 100;
    const successful = total === 0 ? 0 : (pass / total) * 100;
    lines.push(
      `| ${moduleName} | ${pass} | ${fail} | ${pending} | ${total} | ${coverage.toFixed(1)}% | ${successful.toFixed(1)}% |`,
    );
  }

  const overallCoverage = totals.total === 0 ? 0 : ((totals.pass + totals.fail) / totals.total) * 100;
  const overallSuccess = totals.total === 0 ? 0 : (totals.pass / totals.total) * 100;

  lines.push(
    `| **Total** | **${totals.pass}** | **${totals.fail}** | **${totals.pending}** | **${totals.total}** | **${overallCoverage.toFixed(1)}%** | **${overallSuccess.toFixed(1)}%** |`,
    '',
    'Test coverage = (Pass + Fail) / Total. Successful coverage = Pass / Total.',
    '',
    '## Per-test detail',
    '',
    '| Module | ID | Description | Result | Duration (ms) |',
    '|---|---|---|---|---:|',
  );

  for (const row of rows) {
    lines.push(
      `| ${row.module} | ${row.id || '—'} | ${row.description.replaceAll('|', '\\|')} | ${row.result} | ${row.durationMs} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function main(): void {
  if (!existsSync(INPUT)) {
    console.error(`Missing ${INPUT}. Run "npm run test:report" so Vitest emits JSON first.`);
    process.exit(1);
  }

  const rows = buildRows(readJson<VitestJson>(INPUT));
  if (rows.length === 0) {
    console.error('No test results found — refusing to write an empty report.');
    process.exit(1);
  }

  const missing = verifyOfficialIds(rows);

  const csv = [
    'module,id,description,result,duration_ms',
    ...rows.map((row) =>
      [row.module, row.id, row.description, row.result, String(row.durationMs)].map(escapeCsv).join(','),
    ),
  ].join('\n');

  try {
    mkdirSync('test-report', { recursive: true });
    writeFileSync(CSV_PATH, `${csv}\n`, 'utf8');
    writeFileSync(SUMMARY_PATH, summarise(rows), 'utf8');
  } catch {
    const tempDir = os.tmpdir();
    writeFileSync(path.join(tempDir, 'test-report.csv'), `${csv}\n`, 'utf8');
    writeFileSync(path.join(tempDir, 'summary.md'), summarise(rows), 'utf8');
  }

  const passed = rows.filter((row) => row.result === 'Pass').length;
  const failed = rows.filter((row) => row.result === 'Fail').length;
  console.info(`Generated test report (${passed} passed, ${failed} failed).`);

  if (missing.length > 0) {
    console.error(`Missing ${missing.length} official test ID(s): ${missing.join(', ')}`);
    process.exit(1);
  }
}

main();
