# Load Test Spec

**Current, runnable tiers live in [README.md](./README.md)** (Wave-4 Parts
13–14: 50/250/1000-VU tiers, burst spikes, and the recovery scenario, with
production-host guards enforced in `lib/guard.js`).

The table below is the original aspirational scale ladder. It is kept as a
long-range target only — S2+ assume infrastructure (staging at scale,
distributed load generators, a websocket push layer) that does not exist yet.

| Stage | Tool      | Script                       | VUs    | Duration | Pass criteria                       |
|-------|-----------|------------------------------|--------|----------|-------------------------------------|
| S1    | k6        | k6-tier3-burst.js            | 1K     | ~11min   | p95 < 800ms, errors < 1%            |
| S2    | k6        | k6-home-payload.js           | 10K    | 15min    | p95 < 350ms, cache hit > 95%        |
| S3    | k6        | k6-intake-write.js (TBD)     | 100K   | 30min    | p95 < 250ms, no dup intakes         |
| S4    | Artillery | ws-pulse.yaml (TBD)          | 1M ws  | 1h       | median push < 150ms, drops < 0.5%   |
| S5    | Locust    | distributed-burst.py (TBD)   | 10M    | 30min    | error budget burn < 1h              |
