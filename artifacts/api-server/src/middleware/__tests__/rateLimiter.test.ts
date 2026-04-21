import { describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../rateLimiter';
import { setCacheClient } from '../../cache/redisClient';

// Reset the cache between tests so buckets don't leak.
beforeEach(() => {
  const map = new Map<string, { value: unknown; expiresAt: number }>();
  setCacheClient({
    async get(k) {
      const e = map.get(k);
      if (!e || e.expiresAt < Date.now()) return null;
      return e.value as unknown as null;
    },
    async set(k, v, ttl = 60) { map.set(k, { value: v, expiresAt: Date.now() + ttl * 1000 }); },
    async del(k) { map.delete(k); },
    async getOrSet(k, ttl, fn) { const v = await fn(); await this.set(k, v, ttl); return v; },
    async publish() {},
    async subscribe() {},
  });
});

function fakeReq(): Request {
  return { headers: {}, ip: '1.1.1.1' } as unknown as Request;
}
function fakeRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: unknown;
  const res = {
    setHeader(k: string, v: string) { headers[k] = v; },
    status(c: number) { statusCode = c; return res; },
    json(b: unknown) { body = b; return res; },
    get headers() { return headers; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
  return res as unknown as Response & { headers: Record<string, string>; body: unknown };
}

describe('rateLimit middleware', () => {
  it('calls next() on allowed requests and decrements remaining', async () => {
    const mw = rateLimit({ scope: 'test', capacity: 3, refillPerSec: 0 });
    let called = 0;
    const next: NextFunction = () => { called++; };
    const res = fakeRes();
    await mw(fakeReq(), res, next);
    expect(called).toBe(1);
    expect(res.headers['X-RateLimit-Scope']).toBe('test');
    expect(Number(res.headers['X-RateLimit-Remaining'])).toBe(2);
  });

  it('returns 429 once the bucket empties and never calls next()', async () => {
    const mw = rateLimit({ scope: 'tight', capacity: 1, refillPerSec: 0 });
    let called = 0;
    const next: NextFunction = () => { called++; };

    // First call: allowed
    await mw(fakeReq(), fakeRes(), next);
    expect(called).toBe(1);

    // Second call: blocked
    const res2 = fakeRes();
    await mw(fakeReq(), res2, next);
    expect(called).toBe(1);
    expect(res2.statusCode).toBe(429);
    expect(res2.headers['Retry-After']).toBeDefined();
  });

  it('refills tokens over time', async () => {
    // 1 token capacity, refilling 10/sec → after 200ms we have ~1 token again.
    const mw = rateLimit({ scope: 'refill', capacity: 1, refillPerSec: 10 });
    let called = 0;
    const next: NextFunction = () => { called++; };
    await mw(fakeReq(), fakeRes(), next);   // consume
    await new Promise((r) => setTimeout(r, 250));
    await mw(fakeReq(), fakeRes(), next);   // should be allowed again
    expect(called).toBe(2);
  });

  it('fails open by default when the cache throws', async () => {
    setCacheClient({
      async get() { throw new Error('redis down'); },
      async set() {}, async del() {},
      async getOrSet(_k, _t, fn) { return fn(); },
      async publish() {}, async subscribe() {},
    });
    const mw = rateLimit({ scope: 'fail', capacity: 1, refillPerSec: 0 });
    let called = 0;
    await mw(fakeReq(), fakeRes(), () => { called++; });
    expect(called).toBe(1);
  });

  it('fails closed with 503 when failClosed: true and cache throws', async () => {
    setCacheClient({
      async get() { throw new Error('redis down'); },
      async set() {}, async del() {},
      async getOrSet(_k, _t, fn) { return fn(); },
      async publish() {}, async subscribe() {},
    });
    const mw = rateLimit({ scope: 'closed', capacity: 1, refillPerSec: 0, failClosed: true });
    const res = fakeRes();
    let called = 0;
    await mw(fakeReq(), res, () => { called++; });
    expect(called).toBe(0);
    expect(res.statusCode).toBe(503);
  });
});
