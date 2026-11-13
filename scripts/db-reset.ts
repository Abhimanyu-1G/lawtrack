import { rmSync } from 'node:fs';
import path from 'node:path';

import { loadEnvFile } from './load-env';
import { getEnv } from '../src/server/config/env';
import { createDatabase } from '../src/server/db/client';
import { runMigrations } from '../src/server/db/migrate';
import { runSeed } from '../src/server/db/seed';

loadEnvFile();

const env = getEnv();

if (env.isProduction) {
  throw new Error('db:reset refuses to run with NODE_ENV=production');
}

if (env.DB_PATH === ':memory:') {
  throw new Error('db:reset needs a file-backed DB_PATH');
}

const databasePath = path.resolve(process.cwd(), env.DB_PATH);
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  rmSync(`${databasePath}${suffix}`, { force: true });
}
console.info(`Deleted ${databasePath}. Rebuilding…`);

const handle = createDatabase({ path: env.DB_PATH });
try {
  const migrations = runMigrations(handle);
  const result = await runSeed({ handle });

  console.info(
    `Reset complete: ${migrations.applied.length} migration(s), ` +
      `${result.created.guides} guide(s), ${result.created.integrations} integration(s).`,
  );
  if (result.demoAccountsSeeded) {
    console.info(`Demo accounts are available again (password Demo1234 for ${env.CLIENT_ORIGIN}).`);
  }
} finally {
  await handle.close();
}
