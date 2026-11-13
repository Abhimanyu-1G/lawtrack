import 'server-only';

import bcrypt from 'bcryptjs';

/**
 * Password hashing (AGENTS.md §5, §16). Cost 12, stored only as a bcrypt hash.
 * The same cost is used by the seed so demo and real accounts are identical.
 */

export const BCRYPT_COST = 12;

/** A real bcrypt hash used to equalise timing when an email is unknown. */
export const DUMMY_PASSWORD_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, BCRYPT_COST);
}

export function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainText, passwordHash);
}

/** `$2a$`/`$2b$`/`$2y$` with a two-digit cost and the 53-character body. */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}
