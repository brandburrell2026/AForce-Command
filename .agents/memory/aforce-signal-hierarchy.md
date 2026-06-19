---
name: AForce Signal Hierarchy
description: Deterministic per-source priority resolution replacing freshest-wins for source SELECTION; the locked design rules future ladder-wiring must follow.
---

# Signal Hierarchy™ — source-selection design rules

Signal Hierarchy decides **WHICH source's value to use** when several report the
same signal. It is the deterministic-priority replacement for the older
freshest-wins selection (largest `fetchedAt`). It is NOT the Verification Layer —
that grades HOW MUCH confidence to place in whatever source won (phantom >
wearable > phone). Keep the two separate.

## Locked decisions (be consistent with these)
- **Pure priority over non-null availability. NO staleness/recency guard.** The
  highest-priority source that has a non-null value wins, regardless of freshness.
  **Why:** the spec is a fixed ladder; adding recency would re-introduce
  freshest-wins semantics and make selection non-deterministic.
- **`SignalSourceId` is the engine's own superset; do NOT expand `HealthProviderId`
  or the provider catalog.** It adds phantom / apple_watch / samsung_watch /
  voice_checkin / manual / urine_intelligence / hydration_logs — sources outside
  the health-platform catalog.
- **Oura is absent from the Sleep ladder** — Oura sleep "enters through Apple
  Health" (an Oura snapshot populates the `apple_health` slot upstream).
- **Build 100% · Show 10%.** All four ladders (Sleep / Heart Rate / Activity /
  Hydration Verification) are fully built, but only sources actually present in
  `ProviderBiometrics` produce candidates today (whoop/apple_health/samsung_health/
  garmin/google_health for sleep). Phantom/Voice/Manual/watch streams live in the
  ladders but produce no candidate until their data is ingested.

## Wiring (Phase 1) — sleep only
- Only the **Sleep** ladder is wired, into the already-headless, `spec_demand_engine`-
  gated Hydration Demand read path. Gate is `signal_hierarchy_enabled`
  (DEFAULT off / DEMO_ALL_ON on).
- The gate is applied ONCE in `selectHydrationDemandSnapshot`, which forces
  `signalHierarchyEnabled` from the flag so callers can't enable it via overrides.
  The adapter defaults the override to false ⇒ `selectFreshestSleepHours` stays the
  live path (byte-identical when off).
- `selectSleepByHierarchy` returns a shape structurally identical to
  `FreshestSleep` (`{hours, source: HealthProviderId, fetchedAt}`) so it drops into
  `trace.sleepSource` with no type widening. Its "no data" semantics match the
  legacy selector: returns `null`, never fabricates hours.

**How to apply:** when wiring HR / Activity / Hydration-Verification later, give
each its OWN flag (or reuse this one only if intended), keep the resolver pure,
route the gate through the canonical selector (not caller overrides), and verify a
flag-off regression test proves byte-identical legacy behavior.
