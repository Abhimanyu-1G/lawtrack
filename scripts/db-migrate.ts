import { loadEnvFile } from './load-env';
import { getEnv } from '../src/server/config/env';
import { createDatabase } from '../src/server/db/client';
import { runMigrations } from '../src/server/db/migrate';

loadEnvFile();

const env = getEnv();
const handle = createDatabase({ path: env.DB_PATH });

try {
  const result = runMigrations(handle);
  if (result.applied.length === 0) {
    console.info(`Database is up to date (${result.skipped.length} migration(s) already applied).`);
  } else {
    console.info(`Applied ${result.applied.length} migration(s):`);
    for (const name of result.applied) console.info(`  - ${name}`);
  }
} finally {
  await handle.close();
}
