import 'server-only';

import { getDb } from '../src/server/db/client';
import { systemClock, toKolkataDate, toUtcTimestamp } from '../src/server/lib/clock';

/**
 * Seed demo Metric_Event rows so the admin / API-manager dashboards are not
 * empty on a fresh clone. Creates realistic data for the last 30 days.
 */

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function seedDemoMetrics(): Promise<void> {
  const clock = systemClock;

  // Clear existing demo metric events (keep other audit/log data)
  await getDb().db.deleteFrom('Metric_Event').where('ref_id', 'like', 'demo:%').execute();

  const now = clock.now();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const rows: { metric: string; value: number; ref_id: string; created_at: string }[] = [];

  for (let day = 0; day < 30; day++) {
    const date = new Date(thirtyDaysAgo.getTime() + day * 86_400_000);
    const dateStr = toKolkataDate(date);
    const baseTimestamp = toUtcTimestamp(new Date(date.getTime() + 9 * 3_600_000)); // 09:00 IST

    // Chat metrics — several per day
    const chatVolume = randomInt(15, 45);
    for (let i = 0; i < chatVolume; i++) {
      const at = toUtcTimestamp(new Date(date.getTime() + randomInt(9, 21) * 3_600_000 + randomInt(0, 3599) * 1000));
      rows.push({ metric: 'chat_latency_ms', value: randomBetween(800, 3800), ref_id: `demo:chat:${at}`, created_at: at });
      rows.push({ metric: 'chat_grounded', value: randomInt(1, 100) <= 96 ? 1 : 0, ref_id: `demo:chat:${at}`, created_at: at });
    }

    // CSAT — 1-2 per day, ratings 3-5
    if (randomInt(1, 3) <= 2) {
      const at = toUtcTimestamp(new Date(date.getTime() + randomInt(10, 20) * 3_600_000));
      rows.push({ metric: 'chat_csat', value: randomInt(3, 5), ref_id: `demo:csat:${at}`, created_at: at });
    }

    // Availability — one per day, mostly 1
    rows.push({
      metric: 'availability',
      value: randomInt(1, 100) <= 98 ? 1 : 0,
      ref_id: `demo:availability:${dateStr}`,
      created_at: baseTimestamp,
    });

    // Case sync — 5-15 tracked cases per day
    const trackedCases = randomInt(5, 15);
    for (let i = 0; i < trackedCases; i++) {
      const at = toUtcTimestamp(new Date(date.getTime() + randomInt(0, 23) * 3_600_000 + randomInt(0, 3599) * 1000));
      rows.push({ metric: 'case_sync', value: randomInt(1, 100) <= 99 ? 1 : 0, ref_id: `demo:case_sync:${at}`, created_at: at });
    }

    // Case lookup — 3-8 lookups per day
    const lookups = randomInt(3, 8);
    for (let i = 0; i < lookups; i++) {
      const at = toUtcTimestamp(new Date(date.getTime() + randomInt(9, 21) * 3_600_000 + randomInt(0, 3599) * 1000));
      rows.push({ metric: 'case_lookup_ms', value: randomBetween(1200, 4500), ref_id: `demo:lookup:${at}`, created_at: at });
    }

    // Draft regeneration — 0-3 per day
    const regens = randomInt(0, 3);
    for (let i = 0; i < regens; i++) {
      const at = toUtcTimestamp(new Date(date.getTime() + randomInt(9, 18) * 3_600_000 + randomInt(0, 3599) * 1000));
      rows.push({ metric: 'draft_regenerated', value: 1, ref_id: `demo:regen:${at}`, created_at: at });
    }

    // Hearing reminders — 1-4 per day
    const reminders = randomInt(1, 4);
    for (let i = 0; i < reminders; i++) {
      const at = toUtcTimestamp(new Date(date.getTime() + 9 * 3_600_000 + i * 2 * 3_600_000));
      rows.push({ metric: 'hearing_reminder', value: 1, ref_id: `demo:reminder:${at}`, created_at: at });
    }
  }

  // Batch insert
  for (const chunk of chunkArray(rows, 200)) {
    await getDb()
      .db
      .insertInto('Metric_Event')
      .values(chunk)
      .execute();
  }

  console.log(`Seeded ${rows.length} demo metric events`);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// CLI entry point
if (require.main === module) {
  seedDemoMetrics()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}