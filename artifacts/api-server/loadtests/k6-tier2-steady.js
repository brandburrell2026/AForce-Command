// Tier 2 — 250-user steady state with read+write mix (Wave-4 Part 13).
// SAFE ENVIRONMENTS ONLY — setup() aborts on any production host.
//
//   BASE_URL=http://localhost:8080 k6 run loadtests/k6-tier2-steady.js
//
// Mix: liveness + readiness reads, fail-closed entitlement, and unsigned
// webhook posts (exercises raw-body parsing, HMAC rejection, and the
// webhook rate limiter — no entitlement rows are ever written because the
// signature never verifies).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { assertSafeEnvironment } from './lib/guard.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Init-context check: abort before any VU is even allocated (setup() re-checks).
assertSafeEnvironment(BASE_URL, 'Tier 2 (250 VU steady)');

const errorRate = new Rate('errors');
const readMs = new Trend('read_ms', true);
const webhookRejectMs = new Trend('webhook_reject_ms', true);

export const options = {
  stages: [
    { duration: '1m', target: 250 }, // ramp
    { duration: '10m', target: 250 }, // steady
    { duration: '1m', target: 0 },   // drain
  ],
  thresholds: {
    read_ms: ['p(95)<350', 'p(99)<800'],
    webhook_reject_ms: ['p(95)<400'],
    errors: ['rate<0.001'],
  },
};

export function setup() {
  assertSafeEnvironment(BASE_URL, 'Tier 2 (250 VU steady)');
}

export default function () {
  const path = Math.random() < 0.85 ? '/api/healthz' : '/api/healthz/deep';
  const res = http.get(`${BASE_URL}${path}`, { tags: { name: path } });
  readMs.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  check(res, { 'read 200': (r) => r.status === 200 });

  if (Math.random() < 0.1) {
    const hook = http.post(
      `${BASE_URL}/api/shopify/webhook`,
      JSON.stringify({ id: 1, synthetic: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Topic': 'orders/paid',
          'X-Shopify-Hmac-Sha256': 'aW52YWxpZA==', // deliberately invalid
          'X-Shopify-Webhook-Id': `loadtest-${__VU}-${__ITER}`,
        },
        tags: { name: 'shopify_webhook_reject' },
      },
    );
    webhookRejectMs.add(hook.timings.duration);
    // 401 invalid_hmac (or 429 under limiter pressure) is the correct outcome.
    errorRate.add(hook.status !== 401 && hook.status !== 429);
    check(hook, { 'webhook fail-closed (401/429)': (r) => r.status === 401 || r.status === 429 });
  }

  sleep(0.3 + Math.random() * 0.7);
}
