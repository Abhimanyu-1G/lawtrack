/**
 * Pure date/time helpers shared by the server clock and the validators
 * (AGENTS.md §1.6). Nothing here touches Node or browser APIs, so it is safe
 * to import from client form code as well as from `server/lib/clock`.
 *
 * "Today" is always the Asia/Kolkata calendar date. India has a single fixed
 * UTC+05:30 offset with no daylight saving, so plain offset arithmetic is exact
 * and avoids locale/tz database surprises. Timestamps are stored in UTC as
 * `YYYY-MM-DD HH:MM:SS`, dates as `YYYY-MM-DD`.
 */

export const APP_TIME_ZONE = 'Asia/Kolkata';
export const IST_OFFSET_MINUTES = 5 * 60 + 30;

export interface Clock {
  /** Current instant. */
  now(): Date;
  /** UTC timestamp string `YYYY-MM-DD HH:MM:SS` used for every DB column. */
  nowIso(): string;
  /** Today's date in Asia/Kolkata, `YYYY-MM-DD`. */
  today(): string;
  /** Convert any instant to the storage timestamp format. */
  timestamp(date: Date): string;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** `YYYY-MM-DD HH:MM:SS` in UTC. */
export function toUtcTimestamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** `YYYY-MM-DD` date in Asia/Kolkata (which may differ from the UTC date). */
export function toKolkataDate(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * Parse `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` as an Asia/Kolkata wall-clock
 * value. Returns `null` for anything that is not a real calendar date.
 */
export function parseKolkataDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) return null;

  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute) - IST_OFFSET_MINUTES,
    Number(second),
  );
  const parsed = new Date(utcMillis);

  // Reject rolled-over values such as 2026-02-30 or 25:00.
  const shifted = new Date(parsed.getTime() + IST_OFFSET_MINUTES * 60_000);
  const roundTrips =
    shifted.getUTCFullYear() === Number(year) &&
    shifted.getUTCMonth() + 1 === Number(month) &&
    shifted.getUTCDate() === Number(day) &&
    shifted.getUTCHours() === Number(hour) &&
    shifted.getUTCMinutes() === Number(minute) &&
    shifted.getUTCSeconds() === Number(second);

  return roundTrips ? parsed : null;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole hours from `from` to `to` (negative when `to` is in the past). */
export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

export function createSystemClock(): Clock {
  return {
    now: () => new Date(),
    nowIso: () => toUtcTimestamp(new Date()),
    today: () => toKolkataDate(new Date()),
    timestamp: toUtcTimestamp,
  };
}

/**
 * Fixed clock for deterministic tests: `createFixedClock('2026-11-10 12:00:00')`
 * is noon in Kolkata on the fixture date. A `Date` may be passed instead when a
 * test needs a specific instant.
 */
export function createFixedClock(at: string | Date): Clock {
  const instant = at instanceof Date ? new Date(at.getTime()) : parseKolkataDateTime(at);

  if (!instant || Number.isNaN(instant.getTime())) {
    throw new Error(`createFixedClock received an invalid date: ${String(at)}`);
  }

  return {
    now: () => new Date(instant.getTime()),
    nowIso: () => toUtcTimestamp(instant),
    today: () => toKolkataDate(instant),
    timestamp: toUtcTimestamp,
  };
}

export const systemClock: Clock = createSystemClock();
