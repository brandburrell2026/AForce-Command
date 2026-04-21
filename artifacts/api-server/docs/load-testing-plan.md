# AForce OS — Load Testing Plan

## Objective

Validate that AForce OS holds its SLOs under realistic and pathological
traffic up to 10M concurrent users, with architectural confidence to 50M+.

## Tooling

| Tier             | Tool       | Why                                              |
|------------------|------------|--------------------------------------------------|
| HTTP REST        | k6         | scripting, percentile output, cloud distribution |
| WebSocket / SSE  | Artillery  | first-class WS, ramp-and-hold profiles           |
| Massive distrib. | Locust     | trivially horizontal, multi-region runners       |
| Chaos / soak     | toxiproxy  | inject latency, packet loss, partial failures    |

## Stages

| Stage | Concurrent users | Duration | Goal                                          |
|-------|------------------|----------|-----------------------------------------------|
| S1    | 1K               | 5 min    | Smoke — every endpoint responds 2xx           |
| S2    | 10K              | 15 min   | Single-region capacity                        |
| S3    | 100K             | 30 min   | Cross-AZ scale, cache effectiveness           |
| S4    | 1M               | 1 h      | Multi-region, realistic mix                   |
| S5    | 10M              | 30 min   | Burst — measure p99, error budget burn        |
| S6    | 50M (modeled)    | n/a      | Architectural review only — capacity planning |

## Scenarios

### A. Home payload read (read-heavy)
- 80% of total traffic.
- Verifies CDN, edge cache, Redis hot state.
- Pass: p95 < 300ms, error rate < 0.1%, cache hit ratio > 95%.

### B. Intake log (write-heavy)
- 10% of traffic.
- Verifies Postgres write path + Kafka emit + idempotency.
- Pass: p95 < 200ms, no duplicate events under retry, queue lag < 5s.

### C. Pulse stream (long-lived WS)
- 1M concurrent sockets.
- Verifies fanout layer, sticky routing, pod memory under WS pressure.
- Pass: median push < 150ms, no socket drops > 0.5%.

### D. AI command (slow upstream)
- 5% of traffic, with toxiproxy adding +500ms to upstream LLM.
- Verifies fallback at 800ms and template ground floor.
- Pass: zero user-facing 5xx, fallback rate visible in metrics.

### E. Leaderboard fanout (event spike)
- Spike from 100 RPS to 50K RPS over 10s on `competition.update`.
- Verifies cache stampede protection (single-flight + jitter) and stale
  serving.
- Pass: p95 < 300ms, no cache thrashing, no DB saturation.

### F. Scan storm
- 100K scans/min from 100K distinct devices.
- Verifies per-device rate limiter, scan-event partitioning.
- Pass: per-device limit enforced, no other endpoints degrade.

### G. Voice flood
- 10K voice commands/min.
- Verifies AI rate limit + template fallback + idempotency.
- Pass: AI provider not saturated (fallback rate climbs gracefully).

### H. Subscription webhook storm
- 10K Stripe webhooks/min during a campaign launch.
- Verifies webhook idempotency + queue absorption.
- Pass: no duplicate plan changes, queue drains within 60s.

## Bottleneck detection process

For each stage, capture:
- gateway p50/p95/p99 + error rate
- per-service p95
- DB CPU + replication lag
- Redis hit ratio + memory
- Kafka consumer lag per topic
- WS connection count + push latency
- AI provider success rate + fallback rate
- pod CPU/memory + autoscaler events

Bottlenecks are isolated by walking the trace span with the longest
contribution to p95. The first bottleneck removed informs the next stage's
target capacity.

## Acceptance gates

- All stage A–H **pass** with the SLOs in `scaling-architecture.md` §13.
- Error budget burn is documented per stage; > 1h SLO burn at S5 fails the
  release.

## Schedule

- S1–S2: nightly in CI against staging.
- S3: weekly, off-peak, against staging-large.
- S4–S5: monthly, scheduled, against a dedicated load environment.
- S6: quarterly capacity review, no live traffic.

See `loadtests/spec.md` and `loadtests/k6-home-payload.js` for the executable
starting point.
