# AForce OS — Failover & Resilience Strategy

## Failure domains

| Domain          | Blast radius    | Recovery primitive                  |
|-----------------|-----------------|-------------------------------------|
| Single pod      | one user → none | LB removes pod on `/healthz` fail   |
| AZ              | one AZ          | multi-AZ deployment, instant        |
| Region          | one region      | multi-region active/active for read |
| Postgres primary| writes globally | Patroni auto-promote replica        |
| Redis shard     | hot reads       | Redis Cluster automatic failover    |
| Kafka broker    | event ingest    | rf=3, no observable impact          |
| AI provider     | AI commands     | provider switch + template fallback |
| Stripe          | new subscribers | retry queue + degraded UI           |
| Push provider   | notifications   | provider failover (FCM ↔ APNs)      |

## Multi-region topology

- **Reads** — active/active. Each region runs its own app tier + Redis +
  read replica. Closest region wins via geo DNS.
- **Writes** — active/passive. One Postgres primary at a time. On failure,
  Patroni promotes a replica in another region; DNS for `db-write.aforce`
  flips within ~30s. App tier sees a brief 503 burst, mitigated with
  retry-on-503 in the SDK.
- **Fanout / WS** — sticky to region; cross-region broadcast is async.

## Circuit breakers

Every outbound call (DB, Redis, AI, Stripe, push) goes through a breaker:
- Closed → all calls flow.
- Open at ≥ 50% error rate over 30s, or p99 > 5× baseline.
- Half-open after 60s — let one probe through.

Breaker state is exported as a metric and surfaced on the SRE dashboard.

## Retries with backoff

- Idempotent reads: up to 3 attempts, full jitter, max 1s total budget.
- Idempotent writes (with idempotency-key): same.
- Non-idempotent writes: never auto-retried; surfaced to client.

## Degraded modes

| Subsystem      | Degraded behavior                                           |
|----------------|-------------------------------------------------------------|
| AI router      | Deterministic template from voice engine                    |
| Competition    | Last cached leaderboard slice (TTL extended to 5min)        |
| Pulse fanout   | Client polls `/state` every 10s instead of WS               |
| Hardware sync  | Phantom Band local-only; reconcile on next connection       |
| Stripe         | "Upgrade unavailable, try again shortly" instead of 5xx     |
| Notification   | Drop non-critical pushes; keep Heat/Guardian alerts         |
| Analytics      | Frontend hides trends with `data not yet available`         |

Critical safety paths (Heat Guard at HIGH_RISK / CRITICAL, Guardian alerts)
**never** degrade. They bypass cache, run with elevated rate-limit quotas,
and have their own dedicated worker pool.

## Kill switches

`src/config/featureFlags.ts` exposes runtime flags hot-reloaded from Redis:
- `kill.ai_router` — force template fallback.
- `kill.competition_writes` — block leaderboard updates during a hot incident.
- `kill.scan_recognition` — return generic "manual entry" if recognizer is
  poisoned.
- `kill.voice_overlay` — hide the voice button entirely.
- `degrade.home_payload` — serve last-good cache only, no recompute.

Flag flips are auditable (who, when, why) and the runbook page renders the
current flag set.

## Traffic shedding

When a service trips its SLO, the gateway sheds traffic in this order:
1. Drop synthetic check traffic.
2. Drop unauthenticated read traffic (returning a 503 + `Retry-After`).
3. Serve cached payloads with `X-Stale: true`.
4. Reject non-essential write traffic (e.g. `analytics.event` ingest).
5. Last resort — reject all but Heat Guard / Guardian / billing.

## Runbooks

Live at `/runbooks/` in the on-call wiki:
- DB primary down
- Region down
- Redis cluster split-brain
- AI provider 5xx storm
- Kafka consumer lag > 5min
- Subscription webhook flood
- Phantom Band firmware bad release

Each runbook includes: how to detect, how to mitigate (with kill-switch
commands), how to verify recovery, and what to write up post-incident.

## Recovery objectives

| Metric | Target |
|--------|--------|
| RTO (region failover) | 5 min |
| RPO (region failover) | 30 s  |
| RTO (DB primary)      | 60 s  |
| RPO (DB primary)      | 5 s   |
| RTO (single service)  | 30 s  |

## Game days

Quarterly chaos days exercise: kill a primary, kill an AZ, saturate Redis,
poison the AI provider. Pass = SLOs held, runbooks executed without
escalation, post-mortem filed within 72h.
