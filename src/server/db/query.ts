import 'server-only';

/**
 * Small query utilities shared by every repository. Keeps pagination and
 * driver-error translation in one place so route handlers stay thin.
 */

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

export interface PageParams {
  page: number;
  pageSize: number;
  offset: number;
}

/** Coerce user input into a safe page request (services still Zod-validate). */
export function normalisePagination(
  page?: string | number | null,
  pageSize?: string | number | null,
): PageParams {
  const parsedPage = Math.trunc(Number(page ?? 1));
  const parsedSize = Math.trunc(Number(pageSize ?? DEFAULT_PAGE_SIZE));

  const safePage = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  const safeSize =
    Number.isFinite(parsedSize) && parsedSize >= 1
      ? Math.min(parsedSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

interface SqliteErrorLike {
  code?: unknown;
  message?: unknown;
}

function sqliteCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as SqliteErrorLike;
  if (typeof candidate.code === 'string') return candidate.code;
  // Kysely may wrap driver errors; check the cause chain one level deep.
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const nested = (cause as SqliteErrorLike).code;
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = sqliteCode(error);
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

export function isForeignKeyViolation(error: unknown): boolean {
  return sqliteCode(error) === 'SQLITE_CONSTRAINT_FOREIGNKEY';
}

export function isNotNullViolation(error: unknown): boolean {
  return sqliteCode(error) === 'SQLITE_CONSTRAINT_NOTNULL';
}
