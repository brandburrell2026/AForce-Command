# Phase 3 · E — API and Synchronization Design

**Status:** DESIGN ONLY — **no endpoints created, no API altered.** **Updated:** 2026-07-22

---

## 1. Conventions inherited

From `artifacts/api-server/src/routes/`: routers under `routes/aforce/`, `router.use(requireAuth)`,
contracts generated through `lib/api-zod` → `lib/api-spec` → `lib/api-client-react`
(**never hand-write clients**, A25).

## 2. Proposed endpoints

All under `/api/aforce/intelligence`, all auth-gated.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/events` | Batch-ingest events. **Idempotent** on `(user_id, client_event_id)`. |
| `GET` | `/insights` | Selected graph-derived insights for the cache. Active records only. |
| `GET` | `/lpm/snapshot` | Current approved LPM snapshot (§61). |
| `GET` | `/predictions` | Active, unexpired predictions (§39). Post-§42 only. |
| `GET` | `/patterns` | Active DNA patterns (§40). Post-§42 only. |
| `POST` | `/patterns/:id/disposition` | User **challenge / dismiss** (Founder Decision 4). |
| `GET` | `/provenance/:kind/:id` | Resolve a claim to its source events + model version (§41). |
| `GET` | `/sync/cursor` | Pull changes since a cursor; drives cross-device consistency. |

### 2.1 Existing endpoints to extend

| Endpoint | Extension |
|---|---|
| `routes/privacy.ts` | **Add export + account-wide deletion.** No account-wide delete exists today — only `POST /analytics/forget`, which is pseudonymous and stays separate. |
| `routes/profile.ts` | Emit a `profile` intelligence event on version/baseline transition (invalidation trigger). |
| `routes/aforce/*` | Emit behavior/context events at existing write points, additively. |

### 2.2 Founder Mode (internal, Sandbox-only)

`GET /internal/intelligence/inspect` — raw nodes, relationships, provenance chains, prediction
outcomes, pattern history, failed sync. **Never exposed in Production** (§62).

## 3. Idempotency

| Mechanism | Rule |
|---|---|
| **Key** | `clientEventId`, minted on-device, **frozen forever**, never regenerated on retry |
| **Server** | UNIQUE `(user_id, client_event_id)`; insert is `ON CONFLICT DO NOTHING` and returns the existing row — mirrors `aforceProfileVersions.clientChangeId` and `aforceAnalyticsEvents.eventId` |
| **Response** | Per-item status so a partial batch is unambiguous: `{clientEventId, status: 'created' | 'duplicate' | 'rejected', serverId?}` |
| **Derived records** | Deterministic keys from inputs + `model_version` → re-derivation is idempotent |

A retried batch is therefore always safe. This is the property that makes aggressive client retry
acceptable.

## 4. Offline queue

Generalized from the existing intake outbox (A11) — **not a second queue**.

| Property | Rule |
|---|---|
| **Per-user storage key** | `@aforce/intel-outbox:<userId>`. A user transition flips scope, bumps the generation guard, resets in-memory. The previous user's queue stays under **their** key. **Never** clear-on-sign-out — that is lifecycle-fragile and was rejected twice at architect review. |
| **Replay order** | Real chronological order of `occurredAt` — Water-First: water logged first syncs first |
| **Frozen payload** | Queued events are immutable; scores inside them are frozen values the outbox only transports (Score Protection) |
| **Flag-off identity** | Flag off → storage key null → every persist/hydrate/clear is a no-op, byte-identical to today |
| **Bounded** | Cap with oldest-first trim; trimming is logged, never silent |

## 5. Conflict resolution

**`DR-002`: the server is authoritative. The mobile cache is not the authoritative record.**

| Situation | Resolution |
|---|---|
| Same `clientEventId` both sides | Server row wins; client marks `acked` |
| Client has an event the server lacks | Client pushes; server ingests |
| Server has records the client lacks | Client pulls; cache overwritten |
| Divergent derived values | **Server wins.** Client discards its local derivation and adopts the server's. |
| Client derived under an older `model_version` | Server value wins; client re-caches |

Because derivation is the **same pure code** on both sides (Output D §1), divergence should occur
only across model versions or partial data — making server-wins non-destructive rather than a
coin-flip.

## 6. Retry

| Property | Rule |
|---|---|
| Backoff | Exponential with jitter |
| Attempt cap | Config-driven; then `failed`, **retained not dropped**, surfaced in Founder Mode |
| Trigger | App foreground, connectivity regained, post-write |
| Safety | Retry is always safe (§3) |
| Batch | Bounded size; partial success is per-item, never all-or-nothing |

## 7. Degraded behavior

**Fail-closed everywhere.** The system emits nothing rather than emitting unguarded output.

| Condition | Behavior |
|---|---|
| Offline | Queue locally; serve cache; **label served insights as cached** |
| Server unreachable | Cached LPM snapshot + recent context only. **No new predictions or patterns** — they require canonical state. |
| Cache empty and offline | **Insufficient data** — never a fabricated or optimistic default |
| §42 gate unevaluable | **Block output** |
| Sufficiency gates unevaluable | `insufficient_data` |
| Sync lagging | Serve cache; never present stale derived output as current |

## 8. Cross-device consistency

Server-authoritative makes this tractable — it was the main argument for `DR-002`.

- `GET /sync/cursor` returns changes since an opaque cursor; each device converges independently.
- Derived records are **server-owned**, so two devices cannot produce conflicting patterns.
- A new device pulls canonical state and needs no local history — the graph is not lost on device
  change (the primary failure of the device-only alternative).
- Cache is per-user keyed, so multiple accounts on one device never cross-read (**R-13**).

## 9. Security

| Concern | Handling |
|---|---|
| Transport | HTTPS; Clerk JWT `Authorization: Bearer`, matching existing routes |
| At rest (server) | Encrypted; S2/S3 classes per `DATA-CLASSIFICATION-MATRIX` |
| At rest (device) | **Encrypted cache required** — currently plaintext AsyncStorage (`OPEN-RISKS.md` **R-12**, unresolved, Output K) |
| Authorization | Every query scoped by `user_id` from the token, never from the request body |
| Founder Mode | Sandbox-only; writes never reach Production |
