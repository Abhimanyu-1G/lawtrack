import 'server-only';

import { getDevOtp } from '../adapters/otp';
import { getEnv } from '../config/env';

/**
 * Dev-only OTP display (AGENTS.md §11). Returns the last code for an address
 * only when `DEV_SHOW_OTP` is enabled outside production; every other path —
 * including production with the flag set — returns `null`.
 */
export function devOtpFor(email: string | null | undefined): string | null {
  if (!email) return null;

  const env = getEnv();
  if (env.isProduction || !env.DEV_SHOW_OTP) return null;

  return getDevOtp(email)?.code ?? null;
}
