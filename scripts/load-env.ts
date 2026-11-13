import { existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Loads `.env` for one-off scripts. Next.js loads env files automatically, but
 * `tsx`/`node` do not, so every script calls this before reading configuration.
 */
export function loadEnvFile(fileName = '.env'): void {
  const fullPath = path.resolve(process.cwd(), fileName);
  if (!existsSync(fullPath)) return;
  process.loadEnvFile(fullPath);
}

/** Copy `.env.example` to `.env` when the developer has not created one yet. */
export function ensureEnvFile(): { created: boolean; path: string } {
  const target = path.resolve(process.cwd(), '.env');
  if (existsSync(target)) return { created: false, path: target };

  const template = path.resolve(process.cwd(), '.env.example');
  if (!existsSync(template)) {
    throw new Error('Missing .env.example — cannot create .env');
  }

  copyFileSync(template, target);
  return { created: true, path: target };
}
