import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const tempJson = path.join(os.tmpdir(), 'vitest.json');
try {
  execSync(`npx vitest run --reporter=json --outputFile="${tempJson}"`, { stdio: 'inherit' });
} catch {
  // vitest may set exit code if tests fail, but still write json
}
execSync('node --import tsx scripts/test-report.ts', { stdio: 'inherit' });
