# Load, Stress & Recovery Foundation (Wave-4 Parts 13–14)

## Tiers

| Tier | Script              | VUs   | Duration | Target environments            | Pass criteria                                  |
|------|---------------------|-------|----------|--------------------------------|------------------------------------------------|
| 1    | `k6-tier1-smoke.js` | 50    | ~90s     | production allowed (read-only) | liveness p95<200ms, errors<0.5%                |
| 2    | `k6-tier2-steady.js`| 250   | 12m      | staging / local / Docker ONLY  | read p95<350ms, errors<0.1%, webhooks fail-closed |
| 3    | `k6-tier3-burst.js` | 1000 + 2 spikes | ~11m | staging / local / Docker ONLY | read p95<800ms p99<2s, errors<1%              |
| R    | `k6-recovery.js`    | 20    | 5m       | staging / local / Docker ONLY  | honest degradation; outage window measured     |

Safety is enforced in code, not convention: `lib/guard.js` aborts tiers 2/3/R
in `setup()` when `BASE_URL` resolves to a production host
(`aforce-command-production.up.railway.app`, `api.drinkaforce.com`, apex/www).
Tier 1 is the only script allowed at production and is strictly read-only,
with the DB-touching `/api/healthz/deep` sampled at ~5%.

## Running

```bash
# Tier 1 against production (the activation-gate smoke)
BASE_URL=https://aforce-command-production.up.railway.app k6 run loadtests/k6-tier1-smoke.js

# Tiers 2/3/R against a safe environment
BASE_URL=http://localhost:8080 k6 run loadtests/k6-tier2-steady.js
```

`k6 inspect <script>` validates a script and prints its resolved options
without generating load.

## What each tier proves

- **Tier 1** — gateway + edge latency budget, liveness under concurrency,
  the entitlement fail-closed path (401 stays fast under load), and a light
  sample of full readiness (DB round-trip) without becoming DB load itself.
- **Tier 2** — steady-state mixed traffic including unsigned webhook posts:
  raw-body parsing, HMAC rejection, and the webhook limiter under pressure.
  No entitlement rows can be written (signatures never verify).
- **Tier 3** — saturation behavior at 1000 VUs plus two 0→1000 spikes
  (launch-burst model): connection pool, event loop lag, limiter behavior.
- **Recovery** — run it while restarting the server or stopping Postgres.
  Expected truth-preserving behavior: `/api/healthz` stays 200 (no deps);
  `/api/healthz/deep` reports `unready`/`draining` honestly, never a
  fabricated `ok`. The artifact is the measured outage window.

## Environment notes

- Local: `brew install k6`. CI: [grafana/setup-k6-action](https://github.com/grafana/setup-k6-action).
- A "safe environment" is any deployment whose database you can afford to
  lose: local dev server, Docker Compose stack, or a dedicated staging
  deploy. There is currently **no staging deployment** — standing up one
  (Railway second environment) is the prerequisite for tier-2/3/R runs and
  is listed as a founder action in the Wave-4 report.
- Historical `spec.md` tiers (10K/100K/1M/10M) are aspirational scale
  targets, not Wave-4 requirements; `spec.md` now points here.
