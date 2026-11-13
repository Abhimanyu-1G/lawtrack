import { parseKolkataDateTime } from '../clock';

/** Date helpers for validators. Strict about the storage formats in §4. */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** `YYYY-MM-DD` naming a real calendar day. */
export function isRealDate(value: string): boolean {
  return DATE_ONLY.test(value) && parseKolkataDateTime(`${value} 00:00:00`) !== null;
}

/** `YYYY-MM-DD HH:MM:SS` naming a real instant. */
export function parseStorageTimestamp(value: string): Date | null {
  if (!TIMESTAMP.test(value)) return null;
  return parseKolkataDateTime(value);
}
