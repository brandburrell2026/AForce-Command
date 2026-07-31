# Phase 3 · A — Existing Capability Extension Map

**Status:** DESIGN ONLY — nothing implemented. **Updated:** 2026-07-22

The controlling question for every row: **what already exists, and what must be extended rather
than duplicated?** Build Rule 6 forbids parallel systems; Founder Decision 1 forbids duplicating an
existing system.

---

## 1. Headline finding

**Profile Versions™ and Baseline Versions™ already exist server-side, append-only, with an
idempotency contract.** `DR-002` names both as server-authoritative — they already are. Designing
new tables for them would have been the single largest duplication risk in this package.

Likewise, the **command-event ledger** already exists client-side as a pure, tested, append-only
store with adapters onto three engines. §38 consumes it; it does not replace it.

## 2. Extension map

| # | Existing asset | Kind | Extension required | Duplication risk | Mitigation |
|---|---|---|---|---|---|
| A1 | `lib/db/src/schema/aforce.ts` → `aforceProfileVersions` | DB table (append-only, `clientChangeId` idempotency) | **None.** Reference by FK from intelligence events. | 🔴 **High** — a new "profile snapshot" table would fork the source of truth | Reference `profile_version_id`; never re-snapshot |
| A2 | `aforceBaselineVersions` (status/confidence/observationCount/targets) | DB table (append-only, active/archived lifecycle) | **None.** Reference by FK. | 🔴 **High** — §38 confidence could re-implement baseline confidence | Reuse `confidence` + `observationCount` semantics; do not re-derive |
| A3 | `aforceProfileChangeLog` | DB table | **None.** Read for invalidation triggers — a major profile change is an invalidation event. | 🟡 Medium | Treat as an *input* to invalidation, not a new log |
| A4 | `aforceAnalyticsEvents` (pseudonymous, `eventId` unique, ON CONFLICT DO NOTHING) | DB table | **None.** Intelligence events are **separate** — they are user-identified, analytics are pseudonymous by design. | 🔴 **High** — reusing this table would re-identify analytics | **Do not extend.** New table; keep the pseudonymity boundary intact |
| A5 | `aforceHydroScans` (append-only, JSONB payload + denormalized columns) | DB table | **Pattern to copy**, not extend | 🟢 Low | Adopt the JSONB-plus-flat-columns shape |
| A6 | `aforceUserState`, `aforceIntakeLogs`, `aforceScoreSnapshots`, `aforceConfirmations` | DB tables | **None.** Read-only sources for event derivation. | 🟡 Medium | §38 derives *from* them; never writes to them (Score Protection) |
| A7 | `aforcePrivacy` | DB table | **Extend** with intelligence consent/retention fields | 🟢 Low | Add fields; **no JSONB column default** (SCHEMA_DRIFT root cause) |
| A8 | `services/commandLedger.ts` | Client service (AsyncStorage, write queue, merge-on-hydrate, `useSyncExternalStore`) | **Extend** — becomes a sync participant; gains encryption + per-user keying | 🔴 **High** — a second ledger would split truth | §38 reads this ledger; one ledger only |
| A9 | `utils/intelligence/commandEvents.ts` (`mergeCommandEvents`) | Pure util | **Extend** — merge semantics reused for server reconciliation | 🟢 Low | First-wins merge already idempotent |
| A10 | `utils/intelligence/commandEventAdapters.ts` | Pure adapters | **None.** Existing engine signatures stay green. | 🟡 Medium | Additive adapters only |
| A11 | `services/intakeOutbox.ts` + `utils/intakeOutbox/*` | Client offline queue (per-user key, frozen `clientEventId`, chronological replay) | **Pattern to generalize** into a shared outbox for intelligence events | 🔴 **High** — a second queue would double-send | Generalize the existing one; do not clone |
| A12 | `services/hydroScanHistory.ts` | Client service | **Pattern to copy** (deferred write, generation guard) | 🟢 Low | Reference implementation for cache lifecycle |
| A13 | `utils/intelligence/livingPerformanceModel.ts` (§61) | Pure engine, tested | **Extend** — additional source (§38). Exports unchanged. | 🔴 **High** — a "v2 LPM" would fork a tested engine | Additive input only; M-1 regression gate |
| A14 | `types/livingPerformance.ts` | Types | **Extend** — snapshot type for the cached LPM snapshot | 🟢 Low | Additive fields |
| A15 | `utils/intelligence/adaptiveResponseEngine.ts` + `types/adaptiveResponse.ts` (§59) | Pure engine + types | **None.** §38 reads the Personal Response Library. | 🟡 Medium | Read-only consumption |
| A16 | `utils/confidence/*` (`dataConfidence`, `dataFreshness`, `signalQuality`) | Pure utils | **Reuse.** §39's freshness + signal-quality gates (`DR-003`) are already implemented here. | 🔴 **High** — re-implementing freshness/quality would drift from the shipped definition | §39 calls these; defines no parallel notion |
| A17 | `utils/scoringEngine.ts`, `theme/statusColor.ts` | Engines | **OFF-LIMITS — no change** | — | Read-only; flagged if a change appears needed |
| A18 | `config/hydroStateModel.ts` | Config | **Extend** — all new thresholds (`DR-003` values, graph/DNA/retention) | 🟢 Low | Single canonical config source (Build Rule 13) |
| A19 | `featureFlags/flags.ts` | Flags | **Extend** — new flags, all default `false` | 🟢 Low | Output H |
| A20 | `artifacts/api-server/src/routes/aforce/*` | API routes | **Extend** — new intelligence router alongside | 🟡 Medium | Follow existing router + `requireAuth` conventions |
| A21 | `routes/privacy.ts` (scope/field only) | API route | **Extend** — export + account-wide deletion. **No account-wide delete exists today.** | 🟡 Medium | New endpoints; `analytics/forget` is pseudonymous-only and stays separate |
| A22 | `routes/aforce/analytics.ts` → `POST /analytics/forget` | API route | **None.** Precedent only. | 🟢 Low | Different identity domain |
| A23 | `governance/Section-62-Founder-Mode-Spec.md` | Spec | **Extend** — intelligence inspector (Sandbox-only) | 🟡 Medium | Reads only; writes Sandbox only |
| A24 | `vitest.config.ts` pure-runner globs | Test config | **None** — new pure utils are already covered by existing globs | 🟢 Low | Place modules inside covered paths |
| A25 | `lib/api-zod`, `lib/api-spec`, `lib/api-client-react` | Generated API contract | **Extend** — new endpoints flow through the generator | 🟡 Medium | Do not hand-write clients |

## 3. Highest duplication risks, ranked

| Rank | Risk | Why it would happen | Guard |
|---|---|---|---|
| 1 | **Re-implementing profile/baseline versioning** | `DR-002` lists them as server-canonical, reading as "build them" | A1/A2 — they exist; FK only |
| 2 | **A second event ledger** | Server-canonical events read as greenfield | A8 — extend the one ledger |
| 3 | **A second offline queue** | Intelligence sync looks unlike intake sync | A11 — generalize the existing outbox |
| 4 | **Forking the LPM into a "v2"** | Expansion reads like a rewrite | A13 — additive source, exports frozen |
| 5 | **Re-deriving freshness / signal quality** | §39 gates sound new | A16 — call `utils/confidence/*` |
| 6 | **Reusing the analytics table for intelligence events** | Both are append-only event sinks | A4 — pseudonymity boundary must hold |

## 4. Assets that must not change

`utils/scoringEngine.ts` · `theme/statusColor.ts` · scoring math · band definitions ·
status-color mapping · navigation · `EXPO_PUBLIC_DOMAIN` and domain config · existing engine
signatures and their tests.
