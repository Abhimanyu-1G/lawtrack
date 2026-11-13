import 'server-only';

import type { Kysely, Selectable } from 'kysely';

import type { Database, OtpCodeTable } from '../../db/schema';

export type OtpRow = Selectable<OtpCodeTable>;
export type OtpPurpose = 'verify' | 'login';

export interface NewOtp {
  userId: number;
  codeHash: string;
  purpose: OtpPurpose;
  expiresAt: string;
  createdAt: string;
}

/**
 * One-time codes (helper table, AGENTS.md §4). Only the SHA-256 hash of the
 * code is stored. A row is single-use: `consume` sets `consumed_at`, and a new
 * send invalidates any earlier active row for the same purpose.
 */
export function createOtpRepo(db: Kysely<Database>) {
  return {
    async create(input: NewOtp): Promise<OtpRow> {
      return db
        .insertInto('Otp_Code')
        .values({
          user_id: input.userId,
          code_hash: input.codeHash,
          purpose: input.purpose,
          expires_at: input.expiresAt,
          created_at: input.createdAt,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async findLatestUnconsumed(userId: number, purpose: OtpPurpose): Promise<OtpRow | undefined> {
      return db
        .selectFrom('Otp_Code')
        .selectAll()
        .where('user_id', '=', userId)
        .where('purpose', '=', purpose)
        .where('consumed_at', 'is', null)
        .orderBy('otp_id', 'desc')
        .executeTakeFirst();
    },

    async incrementAttempts(otpId: number): Promise<number> {
      const row = await db
        .updateTable('Otp_Code')
        .set((eb) => ({ attempts: eb('attempts', '+', 1) }))
        .where('otp_id', '=', otpId)
        .returning('attempts')
        .executeTakeFirst();
      return row?.attempts ?? 0;
    },

    async consume(otpId: number, at: string): Promise<void> {
      await db.updateTable('Otp_Code').set({ consumed_at: at }).where('otp_id', '=', otpId).execute();
    },

    async invalidateActive(userId: number, purpose: OtpPurpose, at: string): Promise<void> {
      await db
        .updateTable('Otp_Code')
        .set({ consumed_at: at })
        .where('user_id', '=', userId)
        .where('purpose', '=', purpose)
        .where('consumed_at', 'is', null)
        .execute();
    },
  };
}

export type OtpRepo = ReturnType<typeof createOtpRepo>;
