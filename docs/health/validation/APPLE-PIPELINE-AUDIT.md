# Apple Health Pipeline Audit — RC-2 P0 Device-Validation

**Date:** 2026-08-06
**Trigger:** founder-ordered P0 from physical TestFlight build 47 (iPhone 17 Pro, real Apple Health data, Apple Watch paired). Device results: authorization PASS, read-only PASS, disconnect/reconnect PASS. FAILING: values don't match the Health app; refresh doesn't retrieve current values; Home score doesn't update; the score breakdown never reflects Apple Health; freshness is reported incorrectly.
**Branch:** `fix/rc2-apple-pipeline-diagnostics`
**Base commit verified against:** `82551dba` (origin/main, PR #573 — `fix/rc2-apple-refresh-followups`)
**Scope of this PR:** audit + temporary internal diagnostics + two founder-authorized fixes (steps double-count, verify-then-decide on HRV units). No scoring-math changes, no permission/scope changes, no provider-semantic changes beyond the two authorized fixes, no flag default changes.
**Related prior art:** `docs/health/validation/runbook-apple-healthkit.md` (Squad A runbook — already correctly identifies the two-modules problem and the freshness gap; this document adds the per-metric raw-query trace, the device-reported symptom → root-cause mapping, and the diagnostics deliverable).

---

## 0. The one fact that reframes every symptom below

**There are two Apple HealthKit modules in this codebase, and only one is wired to anything a user can reach:**

- **`artifacts/aforce-os/services/appleHealth.ts`** — the **WIRED, LIVE** path. `ProfileScreenV2.tsx`'s `refreshAppleSnapshot()` (services/appleHealth.ts:221 `fetchAppleHealthSnapshot`) is the only thing build 47 ever executes. It requests a fixed permission set, re-queries fixed windows on every call (no persisted anchor/cursor), and returns four plain numbers.
- **`artifacts/aforce-os/services/health/appleHealthSync.ts`** — the **UNWIRED** anchored-query engine (canonical records, provenance, per-record `observedAt`, sleep stages). Its own header states plainly: "RUNTIME ACTIVATION STAYS OFF... not imported by any screen, store, or flag-gated bridge." Verified zero non-test importers.
- `health_canonical_consumers` (default `false` in both `DEFAULT_FLAGS` and `DEMO_ALL_ON_FLAGS`, `featureFlags/flags.ts:312,514`) gates a *different* set of consumers (weekly report, `usePerformanceAge`, `useMetabolicReadiness`, `SleepModeScreen`) — it does **not** gate the score/breakdown path this audit is about. That path (below) is unconditional, always-legacy, regardless of this flag.

Every finding below is about `services/appleHealth.ts` — the legacy path — because that is the only code build 47 can possibly be running.

---

## 1. Per-metric audit table

| Metric | HealthKit identifier queried | Query window | Newest-sample timestamp captured? | Aggregation | Unit handling | Cache | Rendered value's path |
|---|---|---|---|---|---|---|---|
| **HRV (SDNN)** | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | `startDate: new Date(0)` → `now`, `ascending:false, limit:1` (services/appleHealth.ts:255-263) | Yes, but only as "this IS the freshest sample HealthKit has" — no separate freshness signal is surfaced | **Most-recent-sample**, not an average | Requests unit `'ms'` — **verified correct**, see §2 | None — re-queried every call | HK query → `hrvSdnn` local var → `AppleHealthSnapshot.hrvSdnn` → `ProfileScreenV2` `appleSnapshot` state (card) **and** `setAppleHealthSnapshot()` → `biometrics.apple_health.hrvSdnn` → `aggregateBiometrics` → `computeRecoverySignal` → `breakdown.ts` `recovery.delta` → score + `health_signals` row |
| **Resting heart rate** | `HKQuantityTypeIdentifierRestingHeartRate` | Same as HRV | Same as HRV | Most-recent-sample | `'count/min'` — correct, dimensionally exact | None | Same shape as HRV, **except**: `aggregateBiometrics` never reads `restingHeartRate` for `recoveryDelta` — see §5.3 |
| **Steps today** | `HKQuantityTypeIdentifierStepCount` | local-midnight → `now` | N/A (cumulative, not most-recent) | **FIXED THIS PR**: was raw-sample sum across all sources (double-counts iPhone+Watch); now hour-bucketed max-across-sources, see §3 | `'count'` — correct | None | Same store path as above; also floors `activityLevel` in `computeDecayPerMinute` (breakdown.ts:176-188) via `aggregateBiometrics().inferredActivityLevel` |
| **Sleep last night** | `HKCategoryTypeIdentifierSleepAnalysis` | `now − 18h` → `now` | N/A (duration sum) | Sums ASLEEP-state (values 1,3,4,5) sample durations — **verified correct**, matches HealthKit's documented category values | N/A (category, not quantity) | None | Same store path |
| **Workouts** | **NOT QUERIED** | — | — | — | — | — | `HKWorkoutTypeIdentifier` is authorized in `requestAppleHealthPermissions` (appleHealth.ts:119) but `AppleHealthSnapshot` has no workout field and `fetchAppleHealthSnapshot` never calls `queryWorkoutSamples`. Confirmed: `grep -n workout services/appleHealth.ts` → zero hits outside the permission list. |

---

## 2. SUSPECT 2 (HRV unit) — VERIFIED CORRECT, changed nothing

The coordinator flagged this as a suspect, not a confirmed bug, and asked for verification before any edit. Verified against the installed library (`@kingstinct/react-native-healthkit@14.0.2`) and Apple's own conversion semantics:

- `node_modules/@kingstinct/react-native-healthkit/ios/Serializers.swift:40` — every returned sample's `quantity` is produced by `sample.quantity.doubleValue(for: unit)`, i.e. **Apple's own `HKQuantity` dimensional conversion**, not a hand-rolled scale factor. `ms` and HRV SDNN's native unit (seconds) are the same physical dimension (time), so this conversion is exact and correct — there is no "raw value returned in the wrong unit" failure mode here; HealthKit throws/fails loudly on a genuinely incompatible unit, it does not silently mislabel one.
- `node_modules/@kingstinct/react-native-healthkit/lib/typescript/generated/healthkit.generated.d.ts:285` — the library's own **generated, typed default unit** for `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` is literally `"ms"`. Requesting `'ms'` explicitly (`services/appleHealth.ts:261`) is exactly what the library's own type-safe API defaults to.
- `node_modules/.../ios/Helpers.swift:23-29` (`getQueryLimit`) — confirms `limit: 0` (used for steps/sleep) maps to `HKObjectQueryNoLimit` (unlimited), **not** to zero results. This resolves the coordinator's secondary worry about `limit: 0` semantics — also not a bug.

**Verdict: no code change.** HRV magnitude is not the cause of "values don't match the Health app." See §4 for the real candidate.

---

## 3. SUSPECT 1 (steps double-count) — CONFIRMED BUG, FIXED THIS PR

**Root cause.** `services/appleHealth.ts`'s old `stepsToday` computation summed every raw `HKQuantitySample` for the day across every recording source (`queryQuantitySamples`, plain `.reduce`). When an iPhone and a paired Apple Watch (the founder's device configuration, confirmed in devicectl) both independently record steps for the same walking, **HealthKit does not deduplicate that for you** — neither a raw sample sum nor a plain `queryStatisticsForQuantity` cumulativeSum removes cross-source overlap; both simply add every matching sample regardless of source (`ios/QuantityTypeModule.swift`'s `queryStatisticsForQuantityInternal` builds one `HKStatisticsQuery` over the full predicate with no per-source dedup logic — verified by reading the native implementation, not assumed).

**Fix implemented (`services/appleHealth.ts`):**
- `reduceStepsByBucketMax(buckets)` — a new, pure, exported function. Buckets the day into hours via `queryStatisticsCollectionForQuantitySeparateBySource` (`['cumulativeSum']`, `{ hour: 1 }`, per-source), then for each hour bucket takes the **max across sources** rather than the sum, then sums the bucket maxes.
- **Rationale:** within any given hour, whichever device was actually worn/carried captured that hour's real activity most completely; the other device's overlapping count for the same hour is the double-counted portion, not additional real steps. An hour where only one source reported is unaffected (max of one value is that value), so a device the user didn't wear for part of the day never loses real steps the other device caught.
- **Resilience:** if the bucketed query throws (older HealthKit versions, transient failure), the code falls back to the old raw-sum method rather than returning `null` — a refresh never regresses to "no step data" because of this fix.
- **Tests:** `services/__tests__/appleHealth.stepsAggregation.test.ts` — 6 fixtures, including the exact "iPhone 400 + Watch 420, same hour" case, proving the reduction returns 420 (max), not 820 (sum).

**Honesty about this fix's limits — must be confirmed on-device, not assumed.** Per the coordinator's explicit instruction, this is a client-side **approximation** of Apple Health's own per-source reconciliation, not a proven byte-identical match. The diagnostics panel (§6) surfaces, side by side, for direct comparison against the Health app's displayed total:
1. the OLD raw-sample-sum value,
2. the NEW bucketed-max value,
3. each source's whole-day total with its `sourceName`,
4. the raw sample count.

**Expectation:** the NEW (bucketed-max) value should track the Health app's displayed total far more closely than the OLD value, and should sit between "the single highest-reporting source's total" and "the sum of all sources" — closer to the former. If device evidence shows the NEW value still overshoots meaningfully, the likely next refinement is a finer bucket size (e.g. 15-minute buckets) or true interval-overlap reconciliation rather than per-hour granularity; that is a follow-up decision, not something to guess at further in this PR.

---

## 4. SUSPECT 3 (staleness / "refresh doesn't retrieve current values") — MOST LIKELY EXPLANATION FOR THE FOUNDER'S TOP COMPLAINT, NOT FIXED THIS PR (needs a ruling)

Two independent, compounding causes, both real, neither exclusive of the other:

**(a) "Most recent sample ever," not "today's aggregate."** `mostRecentQuantitySample` (services/appleHealth.ts) queries `ascending:false, limit:1` from `new Date(0)` to `now` — this returns the single newest sample HealthKit has, which for RHR (computed once daily by the Watch, typically overnight) and HRV (computed periodically, often only during sleep or a manual reading) can legitimately be many hours old **and will not change between two refreshes taken minutes apart if no new sample was recorded in between.** This is not a code bug — it's HealthKit behaving exactly as asked — but it does not match user intuition of "refresh."

  **This exact behavior is already admitted in-repo**, independent of this audit: `components/profile/AppleHealthRefreshControl.tsx`'s own header (lines 4-8) states: *"A HealthKit re-read completes in well under a second and usually returns byte-identical values"* — the prior engineer who built the refresh-feedback fix (build 45→47) already observed this and treated it as an inherent trait requiring only a "Checked just now" UI confirmation, not a data-freshness fix.

**(b) Semantics mismatch: single sample vs. the Health app's displayed aggregate.** The Health app's headline RHR/HRV numbers are typically a **daily average or a range**, not the single most recent instantaneous sample. Showing "the newest sample" and calling it the same thing as "today's Health app number" is comparing two different statistics, which will diverge even when both are individually correct — this presents to a user exactly as "values don't match."

**Not fixed in this PR — per the coordinator's explicit instruction, this needs a founder ruling because it changes what the score consumes** (switching RHR/HRV from "newest sample" to e.g. "today's average via `queryStatisticsForQuantity(['discreteAverage'])`" is a scoring-input semantics change, not a bug fix, and RHR/HRV values feed `computeRecoverySignal`'s clamp).

**Diagnostics coverage for this exact question:** the panel (§6) shows, per metric, the newest sample's value + `startDate`/`endDate`/`sourceName`, **and** the count of samples in the trailing 24h — so the founder can see on-device, in one look, whether "stale" means "genuinely no new HealthKit data exists" (0-1 samples/24h — a HealthKit/wear-pattern fact, not a bug) or "our query is missing data that exists" (many samples/24h, but our newest-sample logic isn't surfacing the one the Health app shows).

---

## 5. SUSPECT 5 (does Apple Health data reach the score at all?) — PARTIALLY REFUTED: the plumbing is real, but it inherits every upstream defect above

Traced the full path, file:line, per the coordinator's ask:

### 5.1 Full stage trace

| Stage | File:line | What happens |
|---|---|---|
| 1. HealthKit query | `services/appleHealth.ts:221` `fetchAppleHealthSnapshot()` | Returns `AppleHealthSnapshot { restingHeartRate, hrvSdnn, stepsToday, sleepHoursLastNight }` |
| 2. Caller / mapping | `components/profile/ProfileScreenV2.tsx` (`refreshAppleSnapshot`, ~line 396) | Stamps `fetchedAt: Date.now()`, calls `setAppleHealthSnapshot({ ...snap, fetchedAt })` |
| 3. Store write | `store/app/actions.ts:560-590` (`setAppleHealthSnapshot`) | Writes to **two** places: `userState.appleHealth` (legacy field) **and** `userState.biometrics.apple_health` (multi-provider `ProviderSnapshot`, `providerId: 'apple_health'`) |
| 4. Persistence | — | **Neither field is written to AsyncStorage by this action** — it's an in-memory `UserState` mutation only, then immediately re-derived via `fetchHome(merged)`. `AsyncStorage` persistence of `UserState` (if any) happens elsewhere in the store's general persistence path, not specific to this action — confirmed no `AsyncStorage.setItem` call in `setAppleHealthSnapshot` itself. |
| 5. Score recompute | `store/app/actions.ts:583` → `services/mockApi.ts:46` `fetchHome` (or `services/realApi.ts:256` in a real-backend build) → `calculateScore(userState)` | Mock path calls `calculateScore` directly and synchronously; this is what a Debug/TestFlight build without a live backend uses. |
| 6. Scoring engine | `utils/scoringEngine.ts:50-51` `calculateScore` | Delegates to `buildBreakdown(userState, now)` — **`scoringEngine.ts` itself contains zero references to `appleHealth`/`biometrics`** (verified by grep), which could look like non-consumption, but it's delegation, not omission. |
| 7. Breakdown | `utils/scoring/breakdown.ts:93,387` `buildBreakdown` / `calculateBaseScore` | Both call `computeRecoverySignal(state)` and fold `recovery.delta` directly into the summed `raw` score (line 105 / 397) |
| 8. Recovery signal | `utils/scoring/breakdown.ts:286-327` `computeRecoverySignal` | **Prefers `state.biometrics`** (multi-provider) when present, else falls back to legacy `state.appleHealth`. Since step 3 populates `biometrics.apple_health`, this branch is taken. |
| 9. Aggregation | `utils/biometricsAggregator.ts:121` `aggregateBiometrics` | Generic `Object.entries(biometrics)` loop — **no per-provider special-casing needed**, `apple_health` is included automatically. Computes `recoveryDelta` (±10 clamp) from `hrvSdnn`, `sleepHoursLastNight` (freshest-wins across providers) and `inferredActivityLevel` from `stepsToday`/`workoutMinutesToday`/`strain` (max across providers/signals). |
| 10. Breakdown row | `utils/scoring/breakdown.ts:134` | Adds a `{ id: 'health_signals', label: recovery.label, delta: recovery.delta, hint: recovery.hint }` contribution — this **is** the Apple-sourced row the founder expects to see. |
| 11. Home selectors / UI | `store/slices.tsx` `useEngineSlice()` → `ScoreEngineOutput.breakdown` | Consumed by the breakdown sheet UI (outside this PR's scope to re-verify pixel-for-pixel, but the data contract is intact end to end) |

### 5.2 Where this DOES work

The plumbing genuinely works: Apple Health data flows unconditionally (no flag gate) from HealthKit through `aggregateBiometrics` into both the numeric score and a labeled breakdown row. **This is not a "data never reaches scoring" bug.**

### 5.3 Where it silently drops data (the deliverable's most valuable finding)

- **`restingHeartRate` is captured, stored, and displayed — but never consumed by scoring.** `aggregateBiometrics` (utils/biometricsAggregator.ts:163-167) reads `hrvSdnn`, `sleepHoursLastNight`, `readinessScore`, `recoveryPct`, `stressScore` for `recoveryDelta` — `restingHeartRate` is not among them, for **any** provider, not just Apple. This is an existing, cross-provider gap, not an Apple-specific defect, but it means the RHR number on the Profile card has zero effect on the Home score or breakdown despite looking like a live, scored metric.
- **`hrvSdnn` (the deprecated, mixed-semantics field) is what Apple's snapshot writes — not the honest `hrvSdnnMs` field.** `types/biometrics.ts` (re-exporting `@workspace/health-core`'s `contracts.ts:263-273`) documents `hrvSdnn` as `@deprecated`, populated with RMSSD by WHOOP/Oura/Garmin, and states *"only HealthKit's SDNN type would truly be SDNN … never place RMSSD in an SDNN field."* Apple is the one provider that could legitimately use the honest `hrvSdnnMs` field, yet `store/app/actions.ts:571` writes `hrvSdnn: snapshot.hrvSdnn` only. This does not break scoring today (the aggregator still reads the legacy field, which Apple's value happens to correctly occupy), but it is a labeling-honesty debt the audit should name.
- **Workouts are authorized but never queried** (§1) — `workoutMinutesToday`/`strain` (which feed `inferredActivityLevel`) are **never populated from Apple Health**, even though `HKWorkoutTypeIdentifier` read access was explicitly requested. Apple's activity contribution to the score comes from steps alone.
- **`latestObservedAtMs` is never set for Apple.** `store/app/actions.ts`'s `apple_health` `ProviderSnapshot` construction has no `latestObservedAtMs` field at all. See §7.

None of these three are "definite bugs to fix here" per the coordinator's original brief (RHR-unused and workouts-not-queried are scope questions, not bugs; the hrvSdnn/hrvSdnnMs mislabeling is cosmetic/honesty debt) — they're named so the founder can rule on which, if any, warrant a follow-up PR.

---

## 6. Deliverable B — the diagnostics panel (what it captures and where)

**Gate:** `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` (`featureFlags/internalTestflightOverlay.ts`), the exact same build-time seam Ruling A already proved for the elite-flag overlay — `true` only when `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true` (the internal EAS profile). Every other build (production, preview, development, demo) reads `false`, so:
- `isAppleHealthDiagnosticsEnabled()` (`services/appleHealthDiagnostics.ts`) is `false`.
- `getLastAppleHealthDiagnostics()` always returns `null` — gated on **read**, independent of whatever was ever set, so a stray write can't be exposed by a later flag flip.
- `setLastAppleHealthDiagnostics()` is a no-op — gated on **write**, so nothing is even retained in memory.
- `<AppleHealthDiagnosticsPanel enabled={false} .../>` renders `null` — not even an empty wrapper `View`.
- `fetchAppleHealthSnapshot()`'s diagnostics-capture block is skipped entirely — zero extra HealthKit queries, zero extra cost, in every non-internal build.

**What it captures per refresh cycle** (`services/appleHealthDiagnostics.ts`, populated from `services/appleHealth.ts`):
1. **Raw queried samples per metric** — identifier, the newest sample's `startDate`/`endDate`/`quantity`/`unit`/`sourceName`, and a 24h sample count (RHR, HRV).
2. **The mapped snapshot object** — the exact `AppleHealthSnapshot` returned.
3. **The value rendered on the card** — same `AppleHealthSnapshot`, already what the "Live from Apple Health" panel above it displays.
4. **The value handed to the scoring input** — read back verbatim from app state via `AppleHealthDiagnosticsSection` (a small connected wrapper, see below): `state.userState.biometrics.apple_health` and the `health_signals` row from `ScoreEngineOutput.breakdown` — **never recomputed**, so the diagnostics panel cannot itself introduce a scoring discrepancy.
5. **Steps old-vs-new comparison** (per the coordinator's scope expansion): raw-sample-sum, bucketed-max, per-source whole-day totals with `sourceName`, and sample count — side by side, so the founder can compare all of them against the Health app's displayed total in one look.
6. **Workouts row** — explicitly labeled "NOT QUERIED" with the reason, rather than silently omitted.

**Architecture notes:**
- `services/appleHealth.ts` stays store-free by design (its own header). The diagnostics module (`services/appleHealthDiagnostics.ts`) mirrors that — it holds no `scoringInput`; that half is assembled by `components/profile/AppleHealthDiagnosticsSection.tsx`, a small connected wrapper that calls `useEngineSlice()`.
- That subscription is **deliberately isolated to its own leaf component**, not added to `ProfileScreenV2`'s top-level hooks, so it cannot regress the whole-screen re-render optimization RC-1 W3P2 already fought for (`ProfileScreenV2.tsx`'s own header: "every 1s TICK_TIMER re-rendered this entire 3000+ line screen"). In production, the wrapper is never mounted at all, so the subscription never exists there.
- **Location:** the diagnostics module lives at `services/appleHealthDiagnostics.ts` (sibling to `services/appleHealth.ts`), not under `services/health/`, because the latter is scanned by `services/health/__tests__/hardcodedHealthCopy.test.ts` — a lock intended for the permanent, localized Connected Health product surface. This module's English debug text is temporary internal scaffolding, not product copy; allowlisting dozens of debug strings there would misrepresent them as tracked localization debt.
- **Privacy:** in-memory only (a module-level variable, cleared on JS reload/app restart) — no `AsyncStorage`, no network call. Only HealthKit source **names** are captured (e.g. "iPhone", "Brandon's Apple Watch") — the same names the Health app's own "Data Sources" screen already shows the user — never a device identifier, token, or anything transmitted anywhere.

**Files:**
- `artifacts/aforce-os/services/appleHealthDiagnostics.ts` — types, gating, in-memory store, plain-text formatter.
- `artifacts/aforce-os/services/appleHealth.ts` — steps fix + diagnostics capture hook (best-effort, non-blocking, swallows its own errors so a diagnostics bug can never affect the returned snapshot).
- `artifacts/aforce-os/components/profile/AppleHealthDiagnosticsPanel.tsx` — pure presentational, collapsible panel (mirrors `AppleHealthRefreshControl.tsx`'s props-only convention).
- `artifacts/aforce-os/components/profile/AppleHealthDiagnosticsSection.tsx` — connected wrapper (isolates the `useEngineSlice()` subscription).
- `artifacts/aforce-os/components/profile/ProfileScreenV2.tsx` — wiring: captures diagnostics after each refresh, renders the section inside the existing "Live from Apple Health" block, double-gated on `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`.

---

## 7. Freshness ("freshness is incorrect")

Confirmed, not a new finding: `services/health/connectedHealthView.ts:104-113` documents that `ProviderSnapshot.latestObservedAtMs` (Founder Ruling I's observation-freshness axis) has **no server-side derivation path for Apple** — "a provider part 1 (#562) never wired server-side derivation for" — WHOOP/Oura/Garmin have it; Apple and Samsung Health do not. `store/app/actions.ts`'s `apple_health` snapshot construction confirms this client-side: no `latestObservedAtMs` field is ever set. This means the Connected Health card can only show **sync recency** (when AForce last asked HealthKit) for Apple, never true **observation recency** (when the underlying sample was actually recorded) as a separate, honest second axis — this is a known, previously-registered gap (`runbook-apple-healthkit.md`'s "Deviation register"), not something newly discovered here.

Combined with §4's staleness finding, this most likely fully explains the founder's "freshness is incorrect" report: the UI can only ever say "synced just now" even when the underlying HealthKit sample it synced is hours old, because there is no second, honest axis to show the difference for this provider.

---

## 8. Definite bugs — summary + disposition

| # | Bug | Fixed this PR? | Disposition |
|---|---|---|---|
| 1 | Steps double-count (iPhone + Watch) | **YES** | `reduceStepsByBucketMax`, tested, with raw-sum fallback. Needs device confirmation against the Health app's total (diagnostics panel provides the comparison). |
| 2 | HRV unit request | N/A — verified correct | No change made. |
| 3 | "Most recent sample ever" reads as stale / doesn't match Health app's daily-average display | **NO** — semantics change, needs a ruling | Diagnostics panel exposes the evidence (newest sample + 24h count) to inform that ruling. |
| 4 | Workouts authorized but never queried | **NO** — scope decision | Named plainly; not fixed without a ruling on what workout data should do to the score. |
| 5 | `restingHeartRate` captured/displayed but unused by scoring (all providers, not just Apple) | **NO** — pre-existing, cross-provider, out of this PR's scope | Named for founder awareness. |
| 6 | Apple writes the deprecated `hrvSdnn` field instead of the honest `hrvSdnnMs` | **NO** — cosmetic/honesty debt, no functional score impact today | Named for founder awareness. |
| 7 | No `latestObservedAtMs` for Apple (freshness axis) | **NO** — pre-existing, registered gap (#562 follow-up) | Confirmed still open; likely explains "freshness is incorrect" combined with #3. |

---

## 9. Validation run for this PR

```
npx tsc --noEmit -p artifacts/aforce-os/tsconfig.json         → 0 errors
npx vitest run artifacts/aforce-os                             → 4701 passed, 0 failed
                                                                   (12 pre-existing __DEV__-suite
                                                                    collection failures, unrelated —
                                                                    expo-modules-core native-module
                                                                    load wall, matches this repo's
                                                                    documented baseline)
node scripts/src/check-governance-drift.mjs                    → passed
node scripts/src/check-secrets.mjs                              → passed (tracked files)
```

New test files: `services/__tests__/appleHealth.stepsAggregation.test.ts` (6), `services/__tests__/appleHealthDiagnostics.test.ts` (10), `components/profile/__tests__/AppleHealthDiagnosticsPanel.render.test.tsx` (10) — 26 new tests, all passing.
