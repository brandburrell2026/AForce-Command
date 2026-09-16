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

// Wave-2 PR2 (Score Protection backstop): the two snapshot-writing
// routes were previously unthrottled. Limits cap write VOLUME only —
// value bounds live in the zod schemas.
export const snapshotLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "snapshot" },
});

export const sensorImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 6,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "sensor_import" },
});

// Wave-3 PR6: the two provider-webhook routes were unthrottled and
// unauthenticated. Generous IP-keyed cap — providers retry on 429, so a
// legitimate burst is safe; a flood no longer reaches signature
// verification (which, on the Stripe rail, used to construct a pg.Pool
// per request).
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "webhook" },
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

// ─── Trainer surface ───────────────────────────────────────────────────────
//
// Eighteen endpoints shipped with no limit at all, including two PDF
// generators. A chart export holds three full copies of the document in heap
// while it builds, and `allNoteVersions` has no LIMIT, so the ceiling on a
// repeated export is an out-of-memory — and an athlete can reach it on their
// own record, which no authorization check would refuse.
//
// Three tiers, because the costs genuinely differ. All user-keyed: this
// surface has no unauthenticated route, so an IP key would punish a whole
// training room sharing one connection.

/** Reads: the board, a record, notes, sessions, a progression. */
export const trainerReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "trainer_read" },
});

/**
 * Writes: availability, screenings, notes, amendments, sessions, sign-offs.
 *
 * Lower than reads and still far above a human working rate. A trainer
 * clearing a squad enters a few dozen decisions in a morning; 60 a minute is
 * not a person, and the offline outbox flushes a backlog rather than
 * generating one.
 */
export const trainerWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "trainer_write" },
});

/**
 * Document generation: the chart PDF and the availability report.
 *
 * The tightest tier by an order of magnitude. Each of these assembles every
 * questionnaire, screening and note version an athlete has, renders a
 * document, and holds it in memory. Ten a minute is more than anyone
 * legitimately exports and well below what it takes to hurt the process.
 */
export const trainerExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  skip: SKIP_IN_TEST,
  message: { error: "rate_limited", scope: "trainer_export" },
});
