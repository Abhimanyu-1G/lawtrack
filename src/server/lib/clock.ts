import 'server-only';

/**
 * Server clock. The implementation lives in `src/shared/clock.ts` so pure
 * validators and client form code can share the date arithmetic without
 * pulling in the `server-only` guard (AGENTS.md §1.5, §1.6).
 */

export * from '../../shared/clock';
