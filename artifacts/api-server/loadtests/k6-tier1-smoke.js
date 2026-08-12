// Tier 1 — 50-user read-only smoke (Wave-4 Part 13).
//
// The ONLY tier permitted against production: read-only endpoints, modest
// concurrency, and the DB-touching readiness probe sampled at ~5% so the
// smoke itself never becomes meaningful database load.
//
//   BASE_URL=https://aforce-command-production.up.railway.app k6 run loadtests/k6-tier1-smoke.js
//
// Traffic mix per iteration:
//   - /api/healthz            liveness, no dependencies       (always)
//   - /api/entitlement        fail-closed 401 path, auth
//                             middleware + limiter exercised  (~50%)
//   - /api/healthz/deep       readiness incl. DB round-trip   (~5%)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const errorRate = new Rate('errors');
const livenessMs = new Trend('liveness_ms', true);
const entitlementMs = new Trend('entitlement_401_ms', true);
const readinessMs = new Trend('readiness_deep_ms', true);

export const options = {
  stages: [
    { duration: '20s', target: 50 }, // ramp
    { duration: '60s', target: 50 }, // steady
    { duration: '10s', target: 0 },  // drain
  ],
  thresholds: {
    liveness_ms: ['p(95)<200', 'p(99)<500'],
    entitlement_401_ms: ['p(95)<300'],
    readiness_deep_ms: ['p(95)<600'],
    errors: ['rate<0.005'],
  },
};

export default function () {
  const live = http.get(`${BASE_URL}/api/healthz`, { tags: { name: 'healthz' } });
  livenessMs.add(live.timings.duration);
  errorRate.add(live.status !== 200);
  check(live, { 'liveness 200': (r) => r.status === 200 });

  if (Math.random() < 0.5) {
    // No token on purpose: the contract under load is a fast fail-closed 401.
    const ent = http.get(`${BASE_URL}/api/entitlement`, { tags: { name: 'entitlement' } });
    entitlementMs.add(ent.timings.duration);
    errorRate.add(ent.status !== 401 && ent.status !== 429);
    check(ent, { 'entitlement fail-closed (401/429)': (r) => r.status === 401 || r.status === 429 });
  }

  if (Math.random() < 0.05) {
    const deep = http.get(`${BASE_URL}/api/healthz/deep`, { tags: { name: 'healthz_deep' } });
    readinessMs.add(deep.timings.duration);
    errorRate.add(deep.status !== 200);
    check(deep, { 'readiness 200': (r) => r.status === 200 });
  }

  sleep(0.5 + Math.random());
}
