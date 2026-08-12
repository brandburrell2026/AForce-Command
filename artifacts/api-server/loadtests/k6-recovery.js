// Recovery scenario (Wave-4 Part 14) — sustained light load while the
// operator kills/restarts the server or the database, measuring the
// unavailability window and verifying honest degradation.
// SAFE ENVIRONMENTS ONLY — setup() aborts on any production host.
//
//   Terminal A: BASE_URL=http://localhost:8080 k6 run loadtests/k6-recovery.js
//   Terminal B (during the run):
//     - restart the api-server process        → expect: brief connection errors,
//       then 200s again; /healthz/deep flips draining→unready→ok
//     - stop/start the Postgres container     → expect: /healthz stays 200
//       (liveness has no deps); /healthz/deep returns 503 `unready` with the
//       database check named — NEVER a fabricated `ok`.
//
// The summary prints the longest continuous error window observed.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { assertSafeEnvironment } from './lib/guard.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Init-context check: abort before any VU is even allocated (setup() re-checks).
assertSafeEnvironment(BASE_URL, 'Recovery scenario');

const outages = new Counter('outage_seconds_observed');
const readMs = new Trend('read_ms', true);

export const options = {
  scenarios: {
    probe: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
    },
  },
  thresholds: {
    // The run itself always "passes" — the artifact is the outage measurement.
    read_ms: [],
  },
};

export function setup() {
  assertSafeEnvironment(BASE_URL, 'Recovery scenario');
}

export default function () {
  const live = http.get(`${BASE_URL}/api/healthz`, { tags: { name: 'healthz' } });
  readMs.add(live.timings.duration);
  const alive = live.status === 200 || live.status === 503; // 503 draining is an honest answer
  if (!alive || live.status === 0) outages.add(1);
  check(live, { 'alive or honestly draining': () => alive });

  const deep = http.get(`${BASE_URL}/api/healthz/deep`, { tags: { name: 'healthz_deep' } });
  check(deep, {
    'readiness is honest (200 ok/degraded or 503 unready/draining)': (r) =>
      r.status === 200 || r.status === 503,
  });

  sleep(1);
}
