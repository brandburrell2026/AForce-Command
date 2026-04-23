/**
 * Rate limit middleware factories.
 *
 * Per-route limits keep abusive traffic from exhausting the OpenWeather
 * quota or spamming the intake table. Express-rate-limit uses an
 * in-memory store, which is fine for a single api-server replica;
 * swap in a Redis store before scaling horizontally.
 */

import rateLimit from "express-rate-limit";

export const intakeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limited", scope: "intake" },
});

export const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limited", scope: "checkout" },
});

export const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limited", scope: "weather" },
});
