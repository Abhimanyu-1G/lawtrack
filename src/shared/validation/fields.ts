/**
 * Field readers shared by the validators. They trim strings first and
 * distinguish "absent" from "present but not a string" so each rule can report
 * the right code (AGENTS.md §5).
 */

export type RawRecord = Record<string, unknown>;

export function asRecord(input: unknown): RawRecord {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return {};
  return input as RawRecord;
}

export type StringRead = { status: 'missing' } | { status: 'invalid' } | { status: 'ok'; value: string };

/** Trimmed string, with blank and non-string values reported separately. */
export function readString(record: RawRecord, key: string): StringRead {
  const raw = record[key];
  if (raw === undefined || raw === null) return { status: 'missing' };
  if (typeof raw !== 'string') return { status: 'invalid' };

  const value = raw.trim();
  return value === '' ? { status: 'missing' } : { status: 'ok', value };
}

/** Unicode-aware character count: Devanagari matras are not double counted. */
export function charCount(value: string): number {
  return Array.from(value).length;
}

export type NumberRead = { status: 'missing' } | { status: 'invalid' } | { status: 'ok'; value: number };

export function readNumber(record: RawRecord, key: string): NumberRead {
  const raw = record[key];
  if (raw === undefined || raw === null) return { status: 'missing' };
  if (typeof raw !== 'number' || Number.isNaN(raw)) return { status: 'invalid' };
  return { status: 'ok', value: raw };
}
