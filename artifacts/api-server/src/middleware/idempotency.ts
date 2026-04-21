/**
 * Idempotency middleware. Clients pass `Idempotency-Key: <uuid>` on every
 * mutating request. The first response for that key is cached; subsequent
 * retries return the cached response, preventing duplicate intake logs,
 * duplicate Stripe charges, and duplicate notifications under retry storms.
 *
 * Concurrency model:
 *   1. The first request for a key takes an in-process reservation lock
 *      (a Promise) and proceeds.
 *   2. Concurrent retries for the same key wait on that lock and then
 *      return the cached response that the first request wrote.
 *   3. If the cache already has a response, retries return it immediately.
 *
 * Production note: the in-process lock only protects against duplicates on
 * the SAME pod. For cross-pod safety, the production cache implementation
 * MUST back this with Redis SETNX-style atomic reservation:
 *
 *   SET idem:{key} "pending" NX EX 30
 *
 * On success → write the actual response with a longer TTL. The
 * `CacheClient.getOrSet` interface already commits to single-flight, but
 * a strict Redis impl should wrap reservation in a Lua script for safety.
 *
 * Scope = (userId | ip) + endpoint path + key — so two users can't collide
 * and a key can't accidentally reuse across endpoints.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { getCache } from '../cache/redisClient';

const TTL_SEC = 24 * 60 * 60; // keys expire after 24h
const WAIT_TIMEOUT_MS = 5_000;

interface CachedResponse { status: number; body: unknown }

function bucketKey(req: Request, key: string): string {
  const userId = (req as Request & { userId?: string }).userId ?? req.ip ?? 'anon';
  const path = req.baseUrl + req.path;
  return `idem:${userId}:${path}:${key}`;
}

// In-process reservation map — same-pod retries serialize on the first one.
const inflight = new Map<string, Promise<CachedResponse | null>>();

function waitWithTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    p.then((v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } })
     .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
  });
}

export function idempotency(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) { next(); return; }

    const cache = getCache();
    const k = bucketKey(req, key);

    // 1. Cache hit → replay immediately.
    try {
      const cached = await cache.get<CachedResponse>(k);
      if (cached) {
        res.setHeader('Idempotent-Replay', 'true');
        res.status(cached.status).json(cached.body);
        return;
      }
    } catch { /* fall through to fresh */ }

    // 2. In-flight on this pod → wait for the first request to commit.
    const existing = inflight.get(k);
    if (existing) {
      const cached = await waitWithTimeout(existing, WAIT_TIMEOUT_MS);
      if (cached) {
        res.setHeader('Idempotent-Replay', 'true');
        res.status(cached.status).json(cached.body);
        return;
      }
      // Timed out waiting — fall through and process normally.
    }

    // 3. Reserve and process. The reservation resolves with the captured
    //    response (or null on error) so awaiters see the same body.
    let resolveReservation!: (v: CachedResponse | null) => void;
    const reservation = new Promise<CachedResponse | null>((r) => { resolveReservation = r; });
    inflight.set(k, reservation);

    const originalJson = res.json.bind(res);
    let captured: CachedResponse | null = null;
    (res as Response & { json: (body: unknown) => Response }).json = (body: unknown) => {
      captured = { status: res.statusCode, body };
      void cache.set<CachedResponse>(k, captured, TTL_SEC).catch(() => {});
      return originalJson(body);
    };

    res.on('finish', () => {
      resolveReservation(captured);
      inflight.delete(k);
    });
    res.on('close',  () => {
      resolveReservation(captured);
      inflight.delete(k);
    });

    next();
  };
}
