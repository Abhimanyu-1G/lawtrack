import { loadEnvFile } from './load-env';
import { getEnv } from '../src/server/config/env';
import { createDatabase } from '../src/server/db/client';
import { runMigrations } from '../src/server/db/migrate';
import { runSeed } from '../src/server/db/seed';
import { DEMO_ACCOUNT_EMAILS, DEMO_PASSWORD } from '../src/server/db/seed/users';

loadEnvFile();

const env = getEnv();
const handle = createDatabase({ path: env.DB_PATH });

try {
  runMigrations(handle);
  const result = await runSeed({ handle });

  console.info('Seed complete.');
  console.info(
    `  users created: ${result.created.users.length > 0 ? result.created.users.join(', ') : 'none'}`,
  );
  console.info(`  integrations created: ${result.created.integrations}`);
  console.info(`  guides created: ${result.created.guides}`);
  console.info(`  settings created: ${result.created.settings}`);
  console.info(
    `  already present: ${result.skipped.integrations} integration(s), ${result.skipped.guides} guide(s), ` +
      `${result.skipped.settings} setting(s)`,
  );

  if (result.demoAccountsSeeded) {
    console.info('\nDemo accounts (demo only — never use in production):');
    console.info(`  password for all: ${DEMO_PASSWORD}`);
    for (const email of DEMO_ACCOUNT_EMAILS) console.info(`  - ${email}`);
  } else {
    console.info('\nNODE_ENV=production: demo accounts were not seeded.');
  }
} finally {
  await handle.close();
}
