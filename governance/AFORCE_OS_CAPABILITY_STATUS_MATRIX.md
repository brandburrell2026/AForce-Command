# AForce OS — Capability Status Matrix (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Brandon (founder)
**Verified against:** working commit `52986ece` (2026-08-01).

> **Extends `governance/CAPABILITY-STATUS-REGISTER.md`.** That register is canonical for the
> AForce Intelligence™ layer (§38–42, §61) and its status vocabulary. This matrix reuses the same
> 8-label vocabulary (Proposed · Specified · Partially Built · Built-Hidden · Internal Preview ·
> Live · Validated · Blocked, defined in the register §1) and covers the **broader OS surface**
> (routes, product features, providers, commerce, enterprise). Intelligence-layer rows defer to the
> register. Per register §4: *documentation is not evidence; a passing unit test is not a validated
> workflow; a hidden backend is not a live capability.*

Every "Live/Built-Hidden/Internal Preview" row cites code + flag + current visibility.

---

## 1. Core experience

| Capability | Status | Flag (prod default) | Evidence |
|---|---|---|---|
| HydroState engine (hero score) | **Live** | — | `utils/scoringEngine.ts`; model `hydrostate-v0` (`config/hydroStateModel.ts:36`); off-limits |
| Score Protection boundary (server) | **Built-Hidden** | `SCORE_PROTECTION_MODE` (shadow dev / off prod) | `api-server/.../scoreWriteGuard.ts` + `journal.ts:51-93`; shadow-only, enforce = Phase 3B (SS-15) |
| Universal Command Standard (14-field) | **Partially Built** | — | 6–7 fields solid; split across 3 producers; #11/#13 absent (0C; SS-22) |
| Evidence Engine ("why this command") | **Built-Hidden** | `evidence_engine_enabled` off (227) | `utils/scoring/commandEvidence.ts`; fail-closed parity with fired command |
| Home command orchestration (Water-First) | **Live** | — | `utils/homeCommand.ts` pure resolver, water evaluated first |
| Offline intake outbox + idempotency | **Built-Hidden** | `offline_intake_outbox_enabled` off | `services/intakeOutbox.ts`; server `clientEventId` dedupe + `FOR UPDATE` (`intake.ts:84-104`) |
| Canonical event ledger (Kafka envelope) | **Specified** | — | `events/schemas.ts` + in-memory `eventBus.ts` "NOT YET WIRED"; DB append-only logs are the de-facto ledger |
| Multi-device idempotency | **Live** | — | `intake.ts:179-181` + `Idempotency-Key` middleware |
| Redesigned screens (`spec_*`) | **Live** | `spec_*` on | Launch-Readiness §2; af.* token adoption partial |

## 2. Hydration / beverage / activity

| Capability | Status | Flag | Evidence |
|---|---|---|---|
| Hydration tab (live dashboard) | **Partially Built** | `spec_hydration` on | `HydrationScreenV2` — shallow (0D); deep model absent from tab |
| Hydration Demand Engine (deep model) | **Built-Hidden** | `spec_demand_engine` off (146) | `hydrationDemandSelector.ts:5-14` "not consumed by any visible surface" |
| Consumption lifecycle (SCANNED→…→DISCARDED) | **Partially Built** | — | scan/peek→intake separation Live + score-safe; no partial/state machine (RC-L12; SS-23) |
| Fast logging (13 categories) | **Live** | `spec_scan` on | `AddDrinkModal` + `data/drinkCatalog.ts:101-257` |
| Sweat Calculator | **Live** | `spec_sweat` on | ACSM/Baker engine (`sweatRateEngine.ts`); 11 sports; **zero unit tests** (gap) |
| ActivitySession lifecycle | **Proposed** | — | not built; stateless calculator only (0E) |
| Competition | **Internal Preview** | `*_competition_enabled` on | Sound formula, mock opponents + unverified client score (SS-16) |

## 3. Visual intelligence / Performance Age

| Capability | Status | Flag | Evidence |
|---|---|---|---|
| Advanced Visual Intelligence / Skin / Oral Hydration | **Proposed / absent** | — | Does not exist in code (0F) |
| Barcode/product scan | **Live** | `spec_scan` on | `CameraScanModal` |
| Smart Capture (food/drink photo) | **Built-Hidden** | `hydro_scan_2_enabled` off (156) | Server-side OpenAI vision; on-device claim mismatch (SS-10) |
| Urine hydration check (manual, no camera) | **Live** | `spec_urine` on | `UrineCheckScreenV2` color-tile self-select |
| Performance Age | **Built-Hidden** | `performance_age_enabled` off (47) | Non-medical, disclaimer-gated, provisional/established gates, no fabrication, read-only (0F) |

## 4. Supporting intelligence (subordinate to one command; none a competing hero)

| System | Status | Flag |
|---|---|---|
| Adaptive Response Engine / Personal Response Library | Built-Hidden | `adaptive_response_enabled` off |
| Response Timeline | Built-Hidden (+ data-gated 60–90d) | `response_timeline_enabled` off |
| Living Performance Model (daily lesson) | **Live** | — (register §2) |
| Performance Memory / Execution Memory | Built-Hidden | `performance_memory_*` off |
| Performance Identity (classifier) | Built-Hidden (**inert** — always null) | `performance_identity_enabled` off |
| Sleep Readiness / Sleep state | **Live** (engine) | `sleep_mode_enabled` on |
| Recovery Window / Recovery Engine | Built-Hidden ("no visible surfaces") | `spec_recovery` off |
| Climate Profile | **Live** (advisory) | — |
| Environmental Pressure / Location Intelligence | Built-Hidden | `location_intelligence_enabled` off |
| Command Confidence (adaptive selection) | Built-Hidden | `command_confidence_adaptive_enabled` off |
| Command Confidence **Display** | **Live** | `spec_commandConfidenceDisplay` on |
| Data Freshness / Signal Quality display | **Live** | `spec_confidenceDetailSheet` on |
| Tomorrow Load Forecast / Performance Drift / Oral Hydration Signal / AutoPilot | **Proposed / absent** | — (PA-05) |
| Voice Coach / Voice Check-In | Built-Hidden | `voice_checkin_enabled` off |
| Phantom Band | Built-Hidden | `phantom_wearable_enabled` off |
| §38–42 Knowledge Graph / Prediction / DNA / Provenance | **Partially Built / Specified** | see `CAPABILITY-STATUS-REGISTER.md` §2 (authoritative) |

## 5. Commerce

| Capability | Status | Evidence |
|---|---|---|
| Pricing catalog (single-source, parity-tested) | **Live (guarded)** | `data/pricing.ts`, `data/subscriptionPlans.ts` ↔ server mirror; `catalogParity`/`subscriptionPlanParity` tests |
| Command subscription ($20/mo · $200/yr) | **Live** | `subscriptionPlans.ts:103-104`; server `checkout.ts:126-133`; launched |
| Server-side purchase entitlement | **Live** | `checkout.ts` `LAUNCHED_PLAN_IDS`; dark tiers 404; per-feature flag resolution client-side (note) |
| Shopify→app entitlement bridge | **Source-only** | needs `SHOPIFY_WEBHOOK_SECRET` + DB deploy (Launch-Readiness §2) |
| Founding program | **Specified** | governance-only; 200/250 (PA-02) |
| Commerce → HydroState mutation | **N/A (provably absent)** | grep-clean (0K) |

## 6. Enterprise (see `AFORCE_OS_ENTERPRISE_ENTITLEMENT_MATRIX.md`)

| Capability | Status |
|---|---|
| Clutch | Partially Built (client-gated mock) |
| Guardian | Partially Built (client-gated mock; no consent/RBAC/audit; DR-006 copy gap) |
| Personal Cruise Mode | **Live** (consumer, disclaimered) |
| Cruise Industry (B2B) | Specified/Proposed (hidden skeleton) |
| Founder Mode (§62) | **Not Built** (devMode is client-only; §62 never built) |
| Circle/Community | Live (legacy) + Built-Hidden (V2) |
| Sharing privacy controls | Partially Built (defaults inverted; no moderation/age gate) |
| **Night Out Protocol** (current "Social Mode") | **Partially Built; Blocked for Night-Out public exposure** — see `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §15 (naming NO-1, Protocol placement NO-2, BAC/hangover NO-5/NO-6, age/regional NO-8, flag/entitlement NO-10) |

## 7. Health providers (see `AFORCE_OS_HEALTH_SOURCE_MATRIX.md`)

| Provider | Status |
|---|---|
| WHOOP / Oura / Garmin / Strava (token stores + workers) | **Partially Built** (pgcrypto dual-write; Phase C plaintext-drop pending; prod key presence unverified) |
| Apple HealthKit / Android Health Connect / Samsung / Fitbit / Polar / Coros / Suunto | **Specified / Proposed** (per `docs/HEALTH_PLATFORM_INTEGRATION_ARCHITECTURE.md`; provider flags off) |
| Phantom Band / Meridian | Built-Hidden / Proposed |

## 8. Platform quality

| Capability | Status | Evidence |
|---|---|---|
| Design-token single source | **Partially Built** | `afTokens.ts` tested; 256 raw-hex drift across 62 files; low adoption |
| Reduced-motion coverage | **Partially Built** | unified hook; 6 of ~36 animated files consult it |
| Provider-token security | **Partially Built / Blocked-pending-verify** | pgcrypto dual-write; keys env-conditional (SS-03) |
| Consent / deletion / export | **Partially Built** | consent Live; export + deletion **no code** (SS-04) |
| Accessibility conformance | **Partially Built** | strong labels; dynamic-type clamp + a11y screen absent (on main) |
| Automated protected-invariant tests | **Partially Built** | Score-Protection/determinism/offline/flags tested; 0 render/entitlement/a11y tests |
| Performance budgets / crash reporting | **Proposed / no evidence** | backend latency only; no client budgets, no Sentry/Crashlytics |

---

## 9. Truth-lock notes

- No capability above is labeled Live/Validated without code + flag + current visibility.
- **Nothing here is "Validated"** in the register's sense (completed product+privacy+scientific+perf
  validation). The nearest are HydroState core and the consumer money path, which are **Live** but
  carry open reviews (CR-1, Score-Protection enforcement, §20 calibration).
- Intelligence-layer statuses are authoritative in `CAPABILITY-STATUS-REGISTER.md`; any divergence
  should be resolved in favor of that register.
