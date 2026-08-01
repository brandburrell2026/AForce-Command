# Health Platform Integration Architecture — Implementation Specification

_Status: **approval-ready architecture**. This is technical design, sequencing, and
milestones only. **Nothing here is implemented, and no data model or API is changed
by this document.** Several components (OAuth secrets, backend callback routes,
encrypted token storage, entitlement gating, model constants) are **off-limits per
`CLAUDE.md`** and require founder approval before any implementation._

Providers in scope: **Apple Health, Google Health Connect, WHOOP, Oura, Garmin,
Samsung Health, Fitbit, Polar, Coros, Suunto.**

## 1. Principles (non-negotiable)

1. **The engine still owns the score.** Provider signals are normalized into the
   **existing** readiness inputs **read-only**. No integration ever writes, awards,
   or infers a HydroState/readiness score (Score-Protection).
2. **Never fabricate.** A missing/stale signal renders an honest "unavailable /
   estimated / measured" provenance — never a filled-in guess. (Extends the
   existing observation-only discipline.)
3. **Honest connection state, always.** Real per-provider status
   (`connected / disconnected / needs-reauth / syncing / error`), never a
   simulated grant. (`services/healthConnection.ts` already defines a `denied`
   `ConnectionStatus` — today build-only; this makes it real.)
4. **Privacy-first.** Minimal scopes, per-signal consent, revoke ⇒ purge, no
   population comparison, data-classification-aware storage.

## 2. What already exists (reuse)

- **WHOOP is the reference pipeline.** `services/whoop.ts` / `whoopAuth.ts` /
  `whoopConnect.ts` already implement OAuth → token → v2 fetch → app card, with
  server callback `/api/whoop/oauth/callback`, `pgcrypto` encrypted token columns,
  8-char state, and `score_state` handling (see `whoop-oauth-config`). **Every
  cloud-OAuth provider generalizes this.**
- `services/healthConnection.ts` — the provider/connection abstraction (build-only
  UI today); `data/healthProviders.ts` + `data/providerDemoSnapshots.ts` already
  model providers + demo snapshots.
- `components/WhoopSnapshotCard.tsx` — the shipped per-provider card pattern.

## 3. The `HealthProvider` contract (new, typed)

```
type ProviderId =
  | 'apple_health' | 'health_connect' | 'whoop' | 'oura' | 'garmin'
  | 'samsung_health' | 'fitbit' | 'polar' | 'coros' | 'suunto';

type AuthKind = 'on_device_sdk' | 'cloud_oauth2';

type Signal =
  | 'hydration' | 'sleep' | 'hrv' | 'heart_rate' | 'skin_temp'
  | 'workouts' | 'steps' | 'respiratory_rate' | 'spo2';

interface HealthProvider {
  id: ProviderId;
  displayName: string;
  authKind: AuthKind;
  capabilities: Signal[];
  connect(): Promise<ConnectionStatus>;      // OAuth flow or native permission
  status(): Promise<ConnectionStatus>;        // real, honest
  sync(range: { sinceCursor?: string }): Promise<SyncResult>;  // incremental
  disconnect(): Promise<void>;                // revoke + purge
}
```

A **registry** maps `ProviderId → HealthProvider`; the UI (extending
`healthConnection.ts` + the Whoop card) renders each provider's honest status +
capabilities. No provider is a dead link (reuse the `FeatureGate` "DEMO LOCKED"
pattern for not-yet-shipped ones).

## 4. Two auth families

### 4.1 On-device SDK (no OAuth secret, no backend token)
**Apple HealthKit, Google Health Connect, Samsung Health.** Native permission
prompts; data read on-device via the platform SDK; nothing leaves the device
except the normalized signals the user consents to feed the engine.
- iOS: `expo` HealthKit module (custom dev client; not Expo Go). Background
  delivery via `HKObserverQuery`.
- Android: Health Connect client + permissions; incremental reads via changes API.
- **Lowest risk / highest value** — no secrets, no backend. **Do first.**

### 4.2 Cloud OAuth2 (server-mediated) — extends the WHOOP pattern
**WHOOP (done), Oura, Garmin, Fitbit, Polar, Coros, Suunto.** Each needs:
- an OAuth app + **client secret** (server env only — **off-limits**, per provider);
- a **backend callback route** `/api/<provider>/oauth/callback` (mirrors WHOOP);
- **encrypted token storage** (`pgcrypto` columns, like WHOOP) + refresh handling;
- a **webhook receiver** where the provider pushes updates (Oura/Fitbit/Garmin
  support push), else scheduled incremental pulls;
- per-provider **rate-limit** + backoff.

## 5. Sync engine

- **Incremental / delta:** each provider stores a `sinceCursor` (timestamp or
  provider change-token); `sync()` fetches only new data.
- **Offline resilience:** a client queue + retry with backoff; a failed sync keeps
  the last-known honest snapshot + a `stale` provenance, never a fabricated value.
- **Conflict resolution:** when two providers report the same signal (e.g. sleep
  from Oura + Apple Health), resolve by (1) a per-signal **source-priority** table
  (device-measured > cloud-estimated), then (2) freshest timestamp, then (3)
  surface both with provenance rather than silently picking. The user can set a
  preferred source per signal.
- **Provenance tag on every value:** `measured | estimated | unavailable | stale`,
  carried into the UI (extends the Evidence Engine's existing freshness model).

## 6. Readiness-model merge (read-only)

Normalized signals feed the **existing** readiness/HydroState inputs — they do NOT
create a parallel model:
- hydration → intake/target inputs; sleep/HRV/HR/skin-temp/workouts/steps →
  recovery + demand inputs the engine already consumes.
- The engine (`scoringEngine.ts`, `config/hydroStateModel.ts`) is **unchanged and
  off-limits**; integrations only supply richer, honest inputs. A missing signal →
  the engine uses its existing fallback + the UI shows honest "unavailable".
- Any change to *how* the model weights new signals = a `hydroStateModel.ts`
  version change → **DR-009 governance** (Founder + Eng + Scientific approval).

## 7. Privacy & compliance

- **Data-classification-aware** storage (per `governance/DATA-CLASSIFICATION-MATRIX.md`);
  health signals are sensitive → encrypted at rest, minimal retention.
- **Minimal scopes** per provider; **per-signal consent**; **revoke ⇒ purge**
  (disconnect deletes tokens + derived cache).
- No population comparison; honest connection state; HIPAA/SOC2-readiness aligned
  with `docs/COMPLIANCE_FRAMEWORK.md`.

## 8. Entitlement (revenue-guardian territory — flagged)

Which tiers unlock which providers is a **money-path** decision (subscription
gating). Design a `providerEntitlement(providerId, subscription)` seam, but the
gating policy + `AFPrice`/pricing are **off-limits** → founder/revenue-guardian
sign-off.

## 9. Sequencing & milestones

| Phase | Providers | Backend / secrets | Approval | Value |
|---|---|---|---|---|
| **H-A** | Apple Health, Health Connect | none (on-device) | native build only | Highest — no secrets, broad reach |
| **H-B** | Samsung Health | on-device SDK | native build | High (Android) |
| **H-C** | Oura, Fitbit, Garmin | OAuth secrets + backend callbacks + encrypted tokens + webhooks | **Founder (secrets/backend/entitlement)** | High (recovery/sleep) |
| **H-D** | Polar, Coros, Suunto | OAuth (as H-C) | **Founder** | Medium (endurance) |
| **H-E** | Conflict-resolution + provenance polish + skin-temp/SpO2 fusion | — | DR-009 if model weights change | Depth |

WHOOP is already at H-C quality and is the template for the rest.

## 10. Off-limits summary (needs founder approval before implementation)

- OAuth **client secrets** (per provider) and any secret handling.
- **Backend** callback routes, token storage schema, webhook receivers, api-server
  contracts.
- **Entitlement / pricing** for provider access.
- Any `config/hydroStateModel.ts` weighting change (DR-009).
- Persistence/DB schema for tokens + synced signals.

This document is the **design for approval**. Recommended first step (no off-limits
surface): implement **H-A on-device** (Apple Health + Health Connect) behind a
`health_integrations_v2_enabled` flag (default OFF), feeding the existing engine
inputs read-only, with honest connection state — then escalate H-C+ (cloud OAuth)
as an approved backend project.
