# AForce OS — Scaling Architecture (50M+ Concurrent Users)

> Status: blueprint. The shipped api-server is a single Express service today.
> This document describes how to evolve it into a globally-distributed platform
> that survives 50M+ concurrent users without crashing. The
> `src/{cache,events,queues,middleware,observability,health,config}` skeletons
> exist to make that evolution incremental, not a rewrite.

---

## 1. Design principles

1. **Horizontal-first.** Every service scales by adding pods, not bigger boxes.
2. **Stateless app tier.** No request handler holds session state in memory —
   it lives in Redis or the DB. Pods are interchangeable and disposable.
3. **Event-driven.** Heavy work runs after the response. The HTTP path stays
   thin; durable side-effects (analytics, leaderboards, notifications) flow
   through Kafka.
4. **Cache-first reads.** Anything user-facing reads cache first, DB second.
5. **Region-aware.** Users hit the closest edge POP and the closest read
   replica. Writes route to the home region.
6. **Graceful degradation > total failure.** If AI is down we serve a
   deterministic template. If competition is degraded we serve a stale
   leaderboard slice. The Home screen never goes blank.
7. **No single point of failure.** Multi-AZ everywhere. Multi-region for the
   critical read path. Multi-provider for AI.
8. **Real-time and heavy compute are separated.** A slow AI request can never
   block a pulse update.

## 2. Layer map

```
        ┌──────────────────────────────────────────────────────────────────┐
        │  CLIENT (Expo iOS / Android / Web, Phantom Band BLE)             │
        └──────────────────────────────────────────────────────────────────┘
                              │  HTTPS / WSS / SSE
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 1. EDGE / CDN / API GATEWAY                                               │
│    Cloudflare (or AWS CloudFront + AWS WAF). TLS termination, geo-routing,│
│    DDoS scrubbing, edge caching of static assets and idempotent GETs,     │
│    rate limiting at the edge, bot detection.                              │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 2. AUTH                                                                   │
│    Clerk (managed) for JWT issuance + refresh. Tokens validated at the    │
│    edge gateway via JWKS so app pods see a verified `userId` already.     │
└───────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ 3. APP SERVICES (stateless, autoscaled, region-replicated)                │
│    auth-bff │ user-profile │ current-state │ scoring-engine │ pulse │ ai  │
│    intake   │ scan-bff     │ competition   │ subscription   │ team  │     │
│    guardian │ notification │ hardware-sync │ analytics-bff                │
└───────────────────────────────────────────────────────────────────────────┘
              │                │                  │                │
              ▼                ▼                  ▼                ▼
       ┌────────────┐    ┌──────────┐     ┌──────────────┐  ┌────────────┐
       │ 4. REAL-   │    │ 5. CACHE │     │ 6. EVENTS    │  │ 7. AI      │
       │   TIME     │    │  Redis   │     │ Kafka /      │  │ Provider   │
       │ WS/SSE     │    │ Cluster  │     │ Redpanda     │  │ Router     │
       │ fanout     │    │          │     │              │  │            │
       └────────────┘    └──────────┘     └──────────────┘  └────────────┘
                              │                  │                │
                              ▼                  ▼                ▼
                    ┌────────────────┐  ┌──────────────┐  ┌────────────┐
                    │ 8. POSTGRES    │  │ 9. WORKERS   │  │ 10. ANALYT.│
                    │ primary +      │  │ async jobs,  │  │  Snowflake │
                    │ region read    │  │ DLQ, retries │  │  / BigQuery│
                    │ replicas,      │  │              │  │  + S3 raw  │
                    │ sharded        │  │              │  │            │
                    └────────────────┘  └──────────────┘  └────────────┘

         ┌───────────────────────────────────────────────────────────────┐
         │ 11. OBSERVABILITY: OpenTelemetry → Tempo, Prometheus, Loki   │
         │     PagerDuty + synthetic checks + SLO dashboards            │
         └───────────────────────────────────────────────────────────────┘
```

## 3. Services (boundaries + scaling pattern)

| Service              | Sync calls           | Async events emitted                | Owns DB tables                     | Scales on            |
|----------------------|----------------------|-------------------------------------|------------------------------------|----------------------|
| auth-bff             | Clerk JWKS           | `user.signed_in`                    | (none — Clerk owns identity)       | RPS                  |
| user-profile         | profile reads/writes | `profile.updated`                   | users, profiles                    | RPS                  |
| current-state        | hot reads of state   | (consumes intake events)            | (read-only over Redis + Postgres)  | RPS                  |
| scoring-engine       | recomputes on demand | `score.recomputed`                  | (stateless; reads events)          | CPU                  |
| pulse                | streams pulse cfg    | `pulse.changed`                     | (Redis only)                       | WS conn count        |
| ai-command           | LLM calls            | `ai.command.generated`              | command_history (immutable)        | concurrent LLM calls |
| intake               | logs intake          | `intake.logged`                     | intake_events (sharded by user_id) | write QPS            |
| scan-bff             | scan recognize       | `scan.completed`                    | scan_events                        | write QPS            |
| competition          | leaderboard reads    | `rank.changed`                      | leaderboard_rollups                | read QPS + fanout    |
| subscription         | billing webhook      | `subscription.changed`              | subscriptions, plans               | webhook QPS          |
| team / clutch        | team grid reads      | `team.member.changed`               | teams, team_members                | RPS + WS             |
| guardian             | risk evaluation      | `guardian.alert`                    | risk_events                        | event lag            |
| notification         | push/SMS/email       | (consumer, not producer)            | notification_log                   | queue depth          |
| hardware-sync        | BLE telemetry ingest | `hardware.signal`                   | hardware_events (TTL 30d)          | ingest QPS           |
| analytics-bff        | warehouse reads      | (consumes everything)               | (warehouse owns it)                | read QPS             |

Each service ships with: `/healthz` (liveness), `/healthz/deep` (readiness),
explicit shutdown hooks (drain WS, finish in-flight jobs, deregister from LB),
and an OpenTelemetry instrumentor.

## 4. Database strategy

### 4.1 PostgreSQL (transactional)
- **Sharding key** = `user_id` for high-volume tables (`intake_events`,
  `scan_events`, `command_history`, `hardware_events`).
- **Partitioning** = monthly range partitions on the same tables. Drop or
  archive partitions older than 13 months to S3/Parquet.
- **Read replicas** in every active region. Reads route to the closest replica
  via a `db.replicaUrl(region)` helper. Stale reads are tolerable for analytics
  and trends; writes route to the primary.
- **Connection pooling** via PgBouncer in transaction mode. Each pod opens a
  small pool (≤20) and lets PgBouncer multiplex.
- **Migrations** via Drizzle: forward-only, online (no `DROP COLUMN` without a
  3-phase deploy: write-both → read-from-new → drop-old).

### 4.2 Hot state (Redis Cluster)
Lives in Redis, not Postgres:
- `user:{id}:state` — current performance state (TTL 1h, refreshed on every
  intake/score recompute).
- `user:{id}:pulse` — pulse config (TTL 1h).
- `home:{id}:payload` — fully-baked Home screen JSON (TTL 5min, invalidated
  on intake).
- `lb:{scope}:{slice}` — sliced leaderboard pages (TTL 30s).
- `team:{id}:grid` — Clutch team grid snapshot (TTL 15s).
- `flag:{key}` — kill switches and feature flags (TTL 60s, refreshed in BG).

Failure mode: if Redis is unreachable, services degrade to "DB-direct" with a
visible `X-Cache: bypass` header so we can spot it in logs.

### 4.3 Event log (Kafka / Redpanda)
- Topics partitioned by `user_id` so per-user ordering is preserved.
- 7-day retention on hot topics, archived to S3 hourly.
- Schema registry (Avro/JSON Schema) to enforce contracts.

### 4.4 Warehouse (Snowflake / BigQuery)
- Loaded continuously from Kafka via a connector. Owns long-term history,
  cohort metrics, predictive features. Never on the hot path.

### 4.5 Object storage (S3)
- Scan images, profile photos, raw event archives, exported share images.

## 5. Caching rules

| Layer        | What                          | TTL    | Invalidation                          |
|--------------|-------------------------------|--------|---------------------------------------|
| CDN edge     | static assets, marketing pages| 30d    | versioned URLs                        |
| API gateway  | idempotent GETs by URL+token  | 60s    | none — short TTL                      |
| Redis        | user state, pulse, home       | 1h     | event-driven (`intake.logged` busts)  |
| Redis        | leaderboard slices            | 30s    | TTL-only; stale-while-revalidate ok   |
| Redis        | feature flags                 | 60s    | pub/sub on config change              |
| App memory   | tone rules, plan catalog      | proc.  | redeploy                              |

**Never cache:** Heat Guard alerts at HIGH_RISK or CRITICAL, Guardian alerts,
billing state. Safety-critical reads always go to source of truth.

## 6. Event-driven core

Every state-changing action emits exactly one event. See `src/events/schemas.ts`
for the canonical envelope (`eventId`, `eventType`, `userId`, `occurredAt`,
`schemaVersion`, `payload`). All consumers must be idempotent — keyed on
`eventId` — and recoverable from a DLQ.

Event topics:
- `intake.logged`, `symptom.updated`, `urine.signal.updated`,
  `energy.updated`, `protocol.completed`, `score.recomputed`,
  `ai.command.generated`, `heat.risk.changed`, `rank.changed`,
  `hardware.signal`, `subscription.changed`, `share.created`.

Replay: every consumer ships with a `--from-offset` mode for backfill after a
schema change.

## 7. Real-time delivery

| Channel    | Use                                 | Why                              |
|------------|-------------------------------------|----------------------------------|
| WebSocket  | Pulse updates, Clutch grid, voice  | bidirectional, low latency       |
| SSE        | Score updates, Heat Guard alerts    | one-way, survives proxies easily |
| Push (FCM) | Background notifications            | OS-native, works when app closed |
| Polling    | Trends, history (1m+ cadence)       | cheap fallback                   |

Fanout: sticky-routed at the LB so a single user's WS lives on one pod.
Cross-pod broadcast uses Redis pub/sub. For 1M+ concurrent sockets we route
fanout through a dedicated `pulse-edge` service tier, not the app pods.

## 8. AI decisioning at scale

`src/services/ai/router.ts` (skeleton) encapsulates:
- **Provider abstraction** — Anthropic, OpenAI, Gemini behind one interface.
- **Primary + fallback** — fail over within 800ms.
- **Deterministic templates** — if all providers fail, fall back to the
  AForce Voice Engine templates (already shipped). The user gets a calm,
  on-brand line instead of an error.
- **Per-user rate limit** — max N AI commands per minute (token bucket in
  Redis). Beyond that, serve a templated reply.
- **Repeat-pattern cache** — same context within 60s returns the cached line.
- **Async generation** — non-urgent commands (morning reset, recap) run as
  queue jobs, not synchronous HTTP.

## 9. Rate limiting + abuse protection

- **Edge:** Cloudflare WAF — per-IP burst limit, bot challenge, geoblock.
- **Gateway:** per-token sliding window (see `middleware/rateLimiter.ts`).
- **Per-endpoint:** scan, voice, AI command have stricter buckets than reads.
- **Idempotency keys** on every mutating endpoint
  (see `middleware/idempotency.ts`) prevent duplicate intake/subscription
  charges on retry storms.
- **Auth tokens:** short-lived (15min) + refresh; rotation on suspicious use.
- **Leaderboard anti-gaming:** server-side score derivation only; clients
  cannot post a rank.

## 10. Observability

OpenTelemetry → Tempo (traces), Prometheus (metrics), Loki (logs).
SLOs (initial targets):
- Home payload p95 < 300ms (read replica + Redis)
- Intake log p95 < 200ms (write to Postgres, fire-and-forget event)
- Pulse delta < 150ms (WS push)
- AI command p95 < 1s normal, p99 < 3s, fallback at 800ms
- Leaderboard cached p95 < 300ms
- Uptime: 99.95% per region, 99.99% globally (multi-region)

Alerts: PagerDuty on SLO burn rate (fast burn = page, slow burn = ticket),
queue lag > 60s, Redis hit ratio < 90%, DB replication lag > 5s, AI provider
error rate > 2%.

Synthetic checks: every region runs the Home payload, intake log, and
AI command flows every 60s.

## 11. Failover strategy

See `docs/failover-strategy.md`. Summary:
- **Region:** active/active for reads, active/passive for writes (DB primary
  in one region with sub-second replication, promote on failure).
- **DB:** Patroni-managed Postgres with automated failover.
- **Cache:** Redis Cluster with 3 replicas/shard; failover automatic.
- **Queue:** Kafka with rf=3 across AZs; broker loss is invisible.
- **AI:** provider failover inside `ai/router.ts`; deterministic template as
  ground floor.
- **Circuit breakers** per downstream — open at 50% errors over 30s.
- **Traffic shedding:** if a service breaches its SLO, the gateway sheds
  read traffic (returns cached/stale) before write traffic.

## 12. Load testing

See `docs/load-testing-plan.md` and `loadtests/`. Targets validated at 100K,
1M, and architectural assumptions for 10M+ concurrent users. Tooling: k6 for
HTTP, Artillery for WS, Locust for distributed multi-region runs.

## 13. Performance targets (SLOs)

| Flow                  | Latency (p95) | Latency (p99) | Notes                          |
|-----------------------|---------------|---------------|--------------------------------|
| Home payload          | 300ms         | 600ms         | cached + edge POP              |
| Intake log            | 200ms         | 400ms         | write-fast, event-async        |
| Pulse update          | 150ms         | 300ms         | WS push                        |
| AI command (normal)   | 1000ms        | 3000ms        | fallback at 800ms              |
| AI command (degraded) | 50ms          | 100ms         | template path                  |
| Leaderboard           | 300ms         | 600ms         | cached slice                   |
| Scan recognize        | 500ms         | 1500ms        | local DB hit fast, network slow|
| Heat Guard alert      | 100ms         | 250ms         | precomputed, never cached      |

## 14. Codebase conventions

- `src/services/<domain>/` — owns its routes, repository, types, and tests.
- `src/events/` — schemas + bus interface only. Producers/consumers live with
  their owning service.
- `src/queues/` — job definitions + worker entrypoints.
- `src/cache/` — typed cache wrappers per domain.
- `src/middleware/` — generic, no business logic.
- `src/observability/` — metrics + tracing setup. Auto-loaded at boot.
- `src/health/` — liveness + readiness. Drained gracefully on SIGTERM.
- `src/config/` — feature flags + kill switches. Never read env directly in
  business logic — go through `config/`.

## 15. Deployment

- Containers built per service via Buildpacks or Docker.
- Orchestration: Kubernetes (EKS/GKE) with Karpenter or cluster-autoscaler.
- Deploys: blue/green for the gateway, rolling for stateless services,
  canary (5% → 25% → 100%) for risky changes (scoring engine, AI router).
- Secrets: cloud secret manager, never in env files.
- IaC: Terraform for cloud, Helm for K8s.
- CI: typecheck → unit tests → integration tests → load smoke → deploy.

---

**Where the current codebase fits.** The shipped api-server today is one
process serving `/healthz`, `/scans`, `/cycles`, `/checkout/session`. The
modules under `src/{cache,events,queues,middleware,observability,health,
config}` are the integration seams: each one ships with a working in-memory
or no-op default so the server keeps booting, and a clear interface to swap
in the real Redis/Kafka/Prometheus client when we're ready.
