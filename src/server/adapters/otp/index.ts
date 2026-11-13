import 'server-only';

import type { Clock } from '../../lib/clock';
import type { Repositories } from '../../db/repositories';
import type { Logger } from 'pino';
import { getDictionary, type Locale } from '../../../i18n';

/**
 * OTP delivery adapter (AGENTS.md §11). The mock gateway writes a Notification
 * row and keeps the last code in memory so a dev banner can display it. No OTP
 * is ever written to logs or returned by the public API.
 */

export interface SendOtpInput {
  userId: number;
  email: string;
  phoneNumber: string | null;
  code: string;
  purpose: 'verify' | 'login';
  locale: Locale;
  expiryMinutes: number;
}

export interface OtpDelivery {
  channel: 'SMS' | 'Email';
  /** Masked destination, safe to show in the UI. */
  destination: string;
}

export interface OtpGateway {
  send(input: SendOtpInput): Promise<OtpDelivery>;
}

export interface DevOtp {
  email: string;
  code: string;
  purpose: 'verify' | 'login';
  createdAt: string;
}

const devOtps = new Map<string, DevOtp>();

/** Dev-only accessor for the OTP banner; never exposed in production. */
export function getDevOtp(email: string): DevOtp | null {
  return devOtps.get(email.trim().toLowerCase()) ?? null;
}

export function resetDevOtps(): void {
  devOtps.clear();
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 2)}${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-2)}`;
}

export interface MockOtpGatewayOptions {
  repos: Repositories;
  clock: Clock;
  isProduction: boolean;
  logger: Logger;
}

export function createMockOtpGateway(options: MockOtpGatewayOptions): OtpGateway {
  const { repos, clock, isProduction, logger } = options;

  return {
    async send(input: SendOtpInput): Promise<OtpDelivery> {
      const channel: OtpDelivery['channel'] = input.phoneNumber ? 'SMS' : 'Email';
      const rawDestination = input.phoneNumber ?? input.email;
      const destination = input.phoneNumber ? maskPhone(rawDestination) : maskEmail(rawDestination);

      const message = getDictionary(input.locale)
        .auth.otpMessage.replace('{{code}}', input.code)
        .replace('{{minutes}}', String(input.expiryMinutes));

      await repos.notifications.create({
        userId: input.userId,
        message: message.slice(0, 255),
        channel,
        status: 'Sent',
        timestamp: clock.nowIso(),
      });

      devOtps.set(input.email.trim().toLowerCase(), {
        email: input.email.trim().toLowerCase(),
        code: input.code,
        purpose: input.purpose,
        createdAt: clock.nowIso(),
      });

      try {
        await repos.integrations.recordSuccess(4, clock.nowIso());
      } catch (error) {
        logger.warn({ err: error }, 'could not update OTP gateway health');
      }

      if (!isProduction) {
        // Never log the code itself; the dev banner reads `getDevOtp`.
        logger.info({ userId: input.userId, channel, purpose: input.purpose }, 'mock OTP delivered');
      }

      return { channel, destination };
    },
  };
}
