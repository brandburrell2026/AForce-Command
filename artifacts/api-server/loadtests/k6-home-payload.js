// k6 smoke + edge-latency test against the api-server's /healthz endpoint.
//
// Run: BASE_URL=https://staging.aforce.app k6 run loadtests/k6-home-payload.js
//
// Today the api-server only exposes /api/healthz, /api/scans, /api/cycles,
// and /api/checkout/session. This script targets /api/healthz to validate
// the gateway + edge round-trip latency budget. When the real Home payload
// endpoint (`GET /api/home/state`) ships, swap the URL here and re-enable
// the cache-hit ratio assertion (it expects an `X-Cache: hit|miss` header
// that the Home payload route will set).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN    = __ENV.TOKEN    || '';

const errorRate = new Rate('errors');
const latency   = new Trend('healthz_ms', true);

export const options = {
  stages: [
    { duration: '30s', target: 50  }, // ramp
    { duration: '2m',  target: 200 }, // steady
    { duration: '30s', target: 0   }, // ramp down
  ],
  thresholds: {
    'healthz_ms': ['p(95)<200', 'p(99)<500'],
    'errors':     ['rate<0.001'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/healthz`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    tags:    { name: 'healthz' },
  });
  latency.add(res.timings.duration);
  errorRate.add(res.status !== 200);
  check(res, { 'status is 200': r => r.status === 200 });
  sleep(Math.random() * 1);
}
