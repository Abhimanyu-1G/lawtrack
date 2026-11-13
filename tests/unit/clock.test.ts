import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMinutes,
  createFixedClock,
  hoursBetween,
  parseKolkataDateTime,
  toKolkataDate,
  toUtcTimestamp,
} from '../../src/server/lib/clock';

// AGENTS.md §17 fixture instant: 2026-11-10 12:00:00 IST == 06:30:00 UTC.
const FIXTURE = '2026-11-10 12:00:00';

describe('clock', () => {
  it('stores timestamps in UTC for a fixed Kolkata instant', () => {
    const clock = createFixedClock(FIXTURE);
    expect(clock.nowIso()).toBe('2026-11-10 06:30:00');
  });

  it('reports today in Asia/Kolkata', () => {
    const clock = createFixedClock(FIXTURE);
    expect(clock.today()).toBe('2026-11-10');
  });

  it('rolls the Kolkata date forward after 18:30 UTC', () => {
    const clock = createFixedClock(new Date('2026-11-10T18:30:00Z'));
    expect(clock.nowIso()).toBe('2026-11-10 18:30:00');
    expect(clock.today()).toBe('2026-11-11');
  });

  it('keeps the same Kolkata date just before midnight IST', () => {
    expect(toKolkataDate(new Date('2026-11-10T18:29:59Z'))).toBe('2026-11-10');
  });

  it('formats an arbitrary instant as a UTC timestamp', () => {
    expect(toUtcTimestamp(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02 03:04:05');
  });

  it('parses a Kolkata wall-clock datetime', () => {
    const parsed = parseKolkataDateTime('2026-11-10 12:00:00');
    expect(parsed?.toISOString()).toBe('2026-11-10T06:30:00.000Z');
  });

  it('parses a date-only value at Kolkata midnight', () => {
    const parsed = parseKolkataDateTime('2026-11-10');
    expect(parsed?.toISOString()).toBe('2026-11-09T18:30:00.000Z');
  });

  it('rejects an impossible calendar date', () => {
    expect(parseKolkataDateTime('2026-02-30 10:00:00')).toBeNull();
  });

  it('rejects a malformed datetime', () => {
    expect(parseKolkataDateTime('10/11/2026 12:00')).toBeNull();
  });

  it('rejects an out-of-range time', () => {
    expect(parseKolkataDateTime('2026-11-10 25:00:00')).toBeNull();
  });

  it('throws when constructed with an invalid fixture', () => {
    expect(() => createFixedClock('not-a-date')).toThrow(/invalid date/i);
  });

  it('supports deterministic arithmetic helpers', () => {
    const start = new Date('2026-11-10T06:30:00Z');
    expect(addMinutes(start, 90).toISOString()).toBe('2026-11-10T08:00:00.000Z');
    expect(addDays(start, 2).toISOString()).toBe('2026-11-12T06:30:00.000Z');
    expect(hoursBetween(start, addMinutes(start, 90))).toBeCloseTo(1.5);
  });

  it('returns a defensive copy of the fixed instant', () => {
    const clock = createFixedClock(FIXTURE);
    const first = clock.now();
    first.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe('2026-11-10T06:30:00.000Z');
  });
});
