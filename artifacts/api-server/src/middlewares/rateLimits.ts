/**
 * Rate limit middleware factories.
 *
 * Per-route limits keep abusive traffic from exhausting the OpenWeather
 * quota or spamming the intake table. Express-rate-limit uses an
 * in-memory store, which is fine for a single api-server replica;
 * swap in a Redis store before scaling horizontally.
 */

import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Skip the limiter entirely in the test runner so vitest can hammer
// endpoints without tripping 429s. The auth middleware still runs, so
// tests still cover the auth surface — they just bypass throttling.
const SKIP_IN_TEST = (): boolean => process.env["NODE_ENV"] === "test";

// Per-user key when requireAuth has populated req.userId; fall back to
// the IPv6-safe IP key for unauthenticated routes (so an anonymous
// burst still gets shaped before hitting downstream auth gates).
function userOrIpKey(req: Request): string {
  const userId = (req as Request & { userId?: string }).userId;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? "0.0.0.0")}`;
}

export const intakeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "intake" },
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "checkout" },
});

export const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "weather" },
});
