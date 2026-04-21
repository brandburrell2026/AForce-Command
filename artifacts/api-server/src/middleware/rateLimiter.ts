/**
 * Rate limiter middleware. Token-bucket per (key, scope), backed by the
 * cache client so it works across pods. The default in-memory cache buckets
 * per-pod only — production binds Redis for global enforcement.
 *
 * Failure mode: fail-open if the cache backend errors. This is the right
 * tradeoff for a soft business limit (we'd rather serve a user than 5xx
 * because Redis is slow). If you bind this to abuse-critical endpoints,
 * either switch to fail-closed here or front it with the edge WAF.
 *
 * Usage:
 *   app.use(rateLimit({ scope: 'global', capacity: 1000, refillPerSec: 1000 }));
 *   router.post('/scan',  rateLimit({ scope: 'scan',  capacity: 60,  refillPerSec: 1   }));
 *   router.post('/voice', rateLimit({ scope: 'voice', capacity: 30,  refillPerSec: 0.5 }));
 *   router.post('/ai',    rateLimit({ scope: 'ai',    capacity: 10,  refillPerSec: 0.2 }));
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getCache } from '../cache/redisClient';

export interface RateLimitOptions {
  /** Logical bucket name — separates limits per endpoint family. */
  scope: string;
  /** Maximum tokens per bucket. */
  capacity: number;
  /** Token refill rate (tokens per second). */
  refillPerSec: number;
  /** How to derive the per-bucket key. Default = userId || IP. */
  key?: (req: Request) => string;
  /**
   * If true, fail-closed when the cache errors (return 503). Default false
   * (fail-open). Set true for abuse-critical paths.
   */
  failClosed?: boolean;
}

interface BucketState { tokens: number; updatedAt: number }

function defaultKey(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) return `u:${userId}`;
  const fwd = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return `ip:${fwd ?? req.ip ?? 'unknown'}`;
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const { scope, capacity, refillPerSec, failClosed = false } = opts;
  const keyFn = opts.key ?? defaultKey;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const bucketKey = `rl:${scope}:${keyFn(req)}`;
    const now = Date.now();
    try {
      const cache = getCache();
      const prev = (await cache.get<BucketState>(bucketKey)) ?? { tokens: capacity, updatedAt: now };
      const elapsedSec = Math.max(0, (now - prev.updatedAt) / 1000);
      const refilled = Math.min(capacity, prev.tokens + elapsedSec * refillPerSec);
      if (refilled < 1) {
        const retryAfter = Math.ceil((1 - refilled) / Math.max(refillPerSec, 0.001));
        res.setHeader('Retry-After', String(retryAfter));
        res.setHeader('X-RateLimit-Scope', scope);
        res.status(429).json({ error: 'Rate limit exceeded', scope, retryAfter });
        return;
      }
      const nextState: BucketState = { tokens: refilled - 1, updatedAt: now };
      const ttl = Math.ceil(capacity / Math.max(refillPerSec, 0.001)) + 60;
      await cache.set(bucketKey, nextState, ttl);
      res.setHeader('X-RateLimit-Scope', scope);
      res.setHeader('X-RateLimit-Remaining', String(Math.floor(nextState.tokens)));
      next();
      return;
    } catch (err) {
      if (failClosed) {
        res.status(503).json({ error: 'Rate limiter unavailable' });
        return;
      }
      // Fail-open: don't block users on a cache hiccup.
      void err;
      next();
    }
  };
}
