# Load Test Spec

| Stage | Tool      | Script                       | VUs    | Duration | Pass criteria                       |
|-------|-----------|------------------------------|--------|----------|-------------------------------------|
| S1    | k6        | k6-home-payload.js           | 1K     | 5min     | p95 < 300ms, errors < 0.1%          |
| S2    | k6        | k6-home-payload.js           | 10K    | 15min    | p95 < 350ms, cache hit > 95%        |
| S3    | k6        | k6-intake-write.js (TBD)     | 100K   | 30min    | p95 < 250ms, no dup intakes         |
| S4    | Artillery | ws-pulse.yaml (TBD)          | 1M ws  | 1h       | median push < 150ms, drops < 0.5%   |
| S5    | Locust    | distributed-burst.py (TBD)   | 10M    | 30min    | error budget burn < 1h              |

Run `k6 run loadtests/k6-home-payload.js` against `BASE_URL=https://staging…`.
