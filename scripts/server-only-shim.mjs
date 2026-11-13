/**
 * Preload for scripts and one-off tooling.
 *
 * `server-only` intentionally throws unless it is resolved in a React Server
 * Components environment. Operational scripts (migrate, seed, test report) run
 * in plain Node and legitimately reuse server code, so the specifier is mapped
 * to an empty module for those processes only — it never affects the Next.js
 * build, where the real guard stays in force.
 */
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return {
        url: new URL('./server-only-empty.mjs', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
