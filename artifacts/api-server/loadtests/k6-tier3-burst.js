// Tier 3 — 1000-user stress with burst spikes (Wave-4 Part 13).
// SAFE ENVIRONMENTS ONLY — setup() aborts on any production host.
//
//   BASE_URL=http://localhost:8080 k6 run loadtests/k6-tier3-burst.js
//
// Profile: ramp to 1000 VUs, hold, then two 0→1000 spikes to model launch
// bursts (push notification fan-in, morning ritual window). Read-only mix;
// the point is saturation behavior — connection pool, event loop, limiter —
// not write throughput.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { assertSafeEnvironment } from './lib/guard.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Init-context check: abort before any VU is even allocated (setup() re-checks).
assertSafeEnvironment(BASE_URL, 'Tier 3 (1000 VU burst)');

const errorRate = new Rate('errors');
const readMs = new Trend('read_ms', true);

export const options = {
  scenarios: {
    steady_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 1000 }, // ramp
        { duration: '5m', target: 1000 }, // hold
        { duration: '1m', target: 0 },    // drain
      ],
      exec: 'readMix',
    },
    burst_spikes: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '9m',
      stages: [
        { duration: '10s', target: 1000 }, // spike 1
        { duration: '30s', target: 50 },
        { duration: '10s', target: 1000 }, // spike 2
        { duration: '30s', target: 0 },
      ],
      exec: 'readMix',
    },
  },
  thresholds: {
    read_ms: ['p(95)<800', 'p(99)<2000'],
    errors: ['rate<0.01'],
  },
};

export function setup() {
  assertSafeEnvironment(BASE_URL, 'Tier 3 (1000 VU burst)');
}

export function readMix() {
  const res = http.get(`${BASE_URL}/api/healthz`, { tags: { name: 'healthz' } });
  readMs.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  check(res, { 'read 200': (r) => r.status === 200 });
  sleep(0.2 + Math.random() * 0.3);
}
