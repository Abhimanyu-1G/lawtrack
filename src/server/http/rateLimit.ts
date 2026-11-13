import 'server-only';

/**
 * Fixed-window, in-memory rate limiter (AGENTS.md §6, §16).
 *
 * A prototype runs as a single Node process, so a Map is enough. The interface
 * is deliberately small so a Redis-backed limiter can replace it later without
 * touching services. `now` is injectable for deterministic tests.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitDecision;
  reset(key?: string): void;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;

  const sweep = (at: number): void => {
    if (buckets.size < 500) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= at) buckets.delete(key);
    }
  };

  return {
    check(key: string): RateLimitDecision {
      const at = now();
      sweep(at);

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= at) {
        bucket = { count: 0, resetAt: at + options.windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - at) / 1000));

      return {
        allowed: bucket.count <= options.limit,
        remaining: Math.max(0, options.limit - bucket.count),
        retryAfterSeconds,
      };
    },

    reset(key?: string): void {
      if (key === undefined) buckets.clear();
      else buckets.delete(key);
    },
  };
}

/** Login throttle: 10 attempts per 15 minutes per IP + email (AGENTS.md §6). */
export const loginRateLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

/** Chatbot throttle: 20 messages per minute per user (AGENTS.md §8). */
export const chatMessageRateLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
