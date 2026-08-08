# Build-50 Correctness Ledger — Apple Health data pipeline (Gate 1)

**Date:** 2026-08-07
**Author:** react-native-engineer, Build-50 Gate 1 + Gate 3 close-out
**Verified against:** `origin/main` @ `0f81ad51695e3a6258467d80f8006a7d45920180` (re-fetched at session
start; prior context referenced `20961bc7`, which had already advanced by one merge — #628,
unrelated hint-spacing work, no health-pipeline impact).
**Method:** every row below was read directly from the cited file:line in a clean worktree checked
out from the SHA above — no claim is carried forward from a prior document without re-reading the
current source. Where a prior document's claim is contradicted by what the code actually does
today, that is called out explicitly rather than silently corrected.
**Scope boundary:** this ledger covers the WIRED, LIVE path only —
`services/appleHealth.ts` → `utils/biometricsAggregator.ts` → `utils/scoring/breakdown.ts` →
`utils/scoringEngine.ts`. A second, parallel pipeline exists
(`services/health/appleHealthSync.ts` → `services/health/signalResolution.ts` →
`services/health/readinessSignals.ts` / `weeklyHealthAggregates.ts`) and is explicitly **not** this
ledger's subject: it is gated behind `health_canonical_consumers` (default `false`,
`featureFlags/flags.ts`), has zero non-test importers reaching the score path
(`services/health/readinessSignals.ts`'s own header: "the shipping score path still reads the
legacy per-provider snapshot record... ALL of those files are governance-locked... and are NOT
edited"), and feeds only `ReadinessInsightsV2.tsx` / `SleepModeScreen.tsx` — a different product
surface, not the Home hydration score. Confirmed via `grep -rln` for both pipelines' entry points
against `screens/`/`components/`: only the canonical pipeline's two consumers above are reachable
from a real screen; the score path always goes through `utils/biometricsAggregator.ts`.

---

## 1. Per-metric ledger

### HRV (SDNN)

| Field | Value |
|---|---|
| HealthKit identifier | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` |
| Query window | `queryQuantitySamples(..., { ascending: false, limit: 1, unit: 'ms', filter: { date: { startDate: new Date(0), endDate: now } } })` — `services/appleHealth.ts:957-960` |
| Aggregation | **Most-recent single sample**, not an average. Unit request `'ms'` is dimensionally exact for SDNN (verified against the installed `@kingstinct/react-native-healthkit@14.0.2` generated types, which default this identifier's unit to `"ms"` — `docs/health/validation/APPLE-PIPELINE-AUDIT.md` §2, independently re-confirmed by reading `node_modules/@kingstinct/react-native-healthkit/lib/typescript/generated/healthkit.generated.d.ts:285` in this worktree). |
| Transformation | `hrvSdnn = hrvSdnnSample?.quantity ?? null` (`appleHealth.ts:960`); `hrvSdnnObservedAtMs` = sample's own `endDate`, guarded `null` when `hrvSdnn == null` so a present-but-malformed sample never gets a fabricated timestamp (`appleHealth.ts:964`, locked by `services/__tests__/appleHealth.observedAtNullGuard.test.ts:170-184`). |
| Downstream consumer | `buildAppleHealthProviderSnapshot` (`utils/biometricsAggregator.ts:336`) → `biometrics.apple_health.hrvSdnn` → `aggregateBiometrics`'s `freshestNonNull(snaps, 'hrvSdnn', now)` (`biometricsAggregator.ts:399`) → `recoveryDelta` (±5 swing, `biometricsAggregator.ts:416-421`) → `computeRecoverySignal` (`utils/scoring/breakdown.ts:289`) → the `health_signals` breakdown row → `utils/scoringEngine.ts` (via delegation to `buildBreakdown`; `scoringEngine.ts` itself has zero direct references — confirmed by grep, it delegates, does not omit). |
| Status | **LOCKED.** Unit and query shape verified correct twice (this audit + `APPLE-PIPELINE-AUDIT.md` §2); no code change since. |
| Test that locks it | `services/__tests__/appleHealth.test.ts` (unit/shape), `services/__tests__/appleHealth.observedAtNullGuard.test.ts` (null-quantity-sample guard), `utils/__tests__/biometricsAggregator.test.ts` ("THE DEVICE SCENARIO" suite, freshness arbitration). |

### Resting heart rate

| Field | Value |
|---|---|
| HealthKit identifier | `HKQuantityTypeIdentifierRestingHeartRate` |
| Query window | Identical shape to HRV — `queryQuantitySamples(..., { ascending: false, limit: 1, unit: 'count/min', ... })` — `appleHealth.ts:941-944`. |
| Aggregation | Most-recent single sample. |
| Transformation | `restingHeartRate = restingHeartRateSample?.quantity ?? null` (`appleHealth.ts:944`); observed-at guarded identically to HRV (`appleHealth.ts:954-955`). |
| Downstream consumer | **Captured, stored, and displayed — never consumed by scoring.** `buildAppleHealthProviderSnapshot` writes it into `ProviderSnapshot.restingHeartRate` (`biometricsAggregator.ts:335`), but `aggregateBiometrics`'s five `freshestNonNull` reads for `recoveryDelta` are exactly `hrvSdnn`, `sleepHoursLastNight`, `readinessScore`, `recoveryPct`, `stressScore` (`biometricsAggregator.ts:399-403`) — `restingHeartRate` is not among them, for any provider, not just Apple. It also plays no role in `inferredActivityLevel` (`biometricsAggregator.ts:380-393`, which reads `stepsToday`/`workoutMinutesToday`/`strain`/`trainingLoad` only). It DOES feed two non-scoring confidence/data-quality signals: `utils/confidence/gatherDataBehindSignals.ts:58` and `utils/scoring/commandConfidence.ts:67,76` (presence/freshness checks, not the score value itself), and it renders on the Profile card (`components/profile/ProfileScreenV2.tsx:1608-1609`). |
| Status | **NEEDS-FOUNDER-RULING.** This is a scope question, not a bug — the code is doing exactly what it was written to do. The ruling needed: should resting HR contribute to `recoveryDelta` (and if so, what clamp/threshold), or is its cross-provider provenance intentionally confidence-only? `utils/biometricsAggregator.ts` is off-limits to modify without that ruling regardless (Gate-1 hard constraint). |
| Test that locks it | None needed while unconsumed — the absence itself is provable by inspection (`biometricsAggregator.ts`'s five-key list) and is not expected to have a regression test for a feature that doesn't exist. |

### Steps today

| Field | Value |
|---|---|
| HealthKit identifier | `HKQuantityTypeIdentifierStepCount` |
| Query window | Local midnight → `now`, three parallel queries: (1) raw sample sum, `queryQuantitySamples` unpaged (`appleHealth.ts:973-982`); (2) hour-bucketed per-source statistics, `queryStatisticsCollectionForQuantitySeparateBySource(..., { hour: 1 }, ...)` (`appleHealth.ts:996-1002`); (3) HealthKit's own merged statistic, `queryStatisticsForQuantity` (no `SeparateBySource`), **only when diagnostics are enabled** (`appleHealth.ts:1055-1064`). |
| Aggregation | Three competing reductions, all captured every refresh (native-merged only when diagnostics-gated): `sumRawQuantitySamples` (flat sum, double-counts iPhone+Watch overlap), `reduceStepsByBucketMax` (bucket the day into hours, take MAX across sources per bucket, sum the maxes — `appleHealth.ts:252-273`), `stepsNativeMerged` (HealthKit's own cross-source reconciliation via a plain statistics query, per Apple Frameworks Engineer guidance that a statistics query performs its own merge — see `APPLE-PIPELINE-AUDIT.md` §3's citation; **not independently verified from source, since that is Apple's runtime behavior, not this wrapper's code**). |
| Transformation | `stepsToday = stepsUsedFallback ? stepsRawSampleSum : stepsBucketedMax` (`appleHealth.ts:1085`) — **`stepsNativeMerged` is captured but deliberately NOT selected**, pending device evidence (`appleHealth.ts:1066-1084`'s "B1.2" comment). `stepsUsedFallback` trips on either a thrown query error, an empty bucket array with real raw samples present (`appleHealth.ts:1005-1017`, "B1.3"), or an all-zero non-empty bucket array with real raw samples present (`appleHealth.ts:1018-1032`, "SF-2") — both of the latter are the "silent-zero" class Deliverable 2 asked me to hunt for; both are already fixed and locked (see tests below). Final value rounded at snapshot assembly, not before (`appleHealth.ts:1235`, with a documented reason: HealthKit statistics-collection bucket boundaries can leave the pre-round total fractional). |
| Downstream consumer | `biometrics.apple_health.stepsToday` → `aggregateBiometrics`'s `activityFromSteps` (`biometricsAggregator.ts:381`) → `inferredActivityLevel` → **only** consumed as a FLOOR on the manual activity slider inside `computeDecayPerMinute` (`utils/scoring/breakdown.ts`, activity-floor block) — it does **not** touch the `health_signals` breakdown row at all (confirmed: the floor only overrides `state.activityLevel` when `aggregateBiometrics(...).inferredActivityLevel > state.activityLevel`, a `>` comparison against the ROUNDED inferred value, so small step counts near a threshold can be silently discarded by rounding — named, not fixed, in `APPLE-PIPELINE-AUDIT.md` §5.4, and unchanged since). |
| Status | **OPEN — this is Gate 3, device evidence required.** Which of the three numbers matches the Health app's own displayed total cannot be determined from source review (Apple's internal HealthKit merge behavior is not visible to this wrapper). The silent-zero sub-bugs (B1.3, SF-2) are **LOCKED**. |
| Test that locks the closed sub-bugs | `services/__tests__/appleHealth.stepsSelection.test.ts` (B1.3 empty-bucket-with-real-samples fallback, SF-2 all-zero-bucket fallback, genuine-zero-day non-fallback, native-merged capture-without-selection), `services/__tests__/appleHealth.stepsAggregation.test.ts` (6 fixtures on `reduceStepsByBucketMax`), `services/__tests__/appleHealth.stepsAdapter.test.ts` (11 fixtures on `mapStatsToBuckets`), `services/__tests__/appleHealth.observedAtNullGuard.test.ts` (steps timestamped-null guard on double-failure). |

### Sleep last night

| Field | Value |
|---|---|
| HealthKit identifier | `HKCategoryTypeIdentifierSleepAnalysis` |
| Query window | **`now − 18h` → `now`** — `appleHealth.ts:914`: `const lastNightStart = new Date(now.getTime() - 18 * 60 * 60 * 1000);`. This is the FIXED 18-hour window, unchanged on `origin/main` as of this SHA — see "Coordination note" below; a wider, session-clustering replacement exists but is **not on this branch and not merged**. |
| Aggregation | Per-source coverage selection (`selectSleepIntervals`, `appleHealth.ts:636-685`) — any HealthKit source that wrote a stage sample (core/deep/REM) is "authoritative" for every span it wrote anything at all in (asleep, awake, or inBed); a different source's coarser "asleep unspecified" layer only fills stretches the stage-capable source never touched at all. Then interval-union merge (`reduceSleepByIntervalUnionDetailed`, `appleHealth.ts:725-749`) guards both cross-source AND same-source overlap. This closes the cross-source double-count defect device-confirmed on build 48 (13.33h-from-49-samples). |
| Transformation | `sleepHoursLastNight = unionMs / MS_PER_HOUR`, `null` (not `0`) when the adapter had to drop malformed raw samples AND selection came back empty (`appleHealth.ts:1211-1218`, "S2" — distinguishes "confirmed zero" from "unknown," the same class of bug as the steps silent-zero fixes, already closed here). `sleepHoursLastNightObservedAtMs` = the union's own `lastEndMs`, `null` on the unknown-data path (`appleHealth.ts:1219`). |
| Downstream consumer | Same path as HRV: `freshestNonNull(snaps, 'sleepHoursLastNight', now)` (`biometricsAggregator.ts:400`) → `recoveryDelta` (±5 swing, `biometricsAggregator.ts:422-427`) → `health_signals` row → score. |
| Status | **OPEN.** The cross-source/same-source double-counting defect (Founder Ruling A, F1, F2) is **LOCKED** — see tests below. The **18-hour fixed-window truncation defect is a SEPARATE, still-open bug on this SHA**: HealthKit's date filter is overlap-matching and returns a matching sample WHOLE, never truncated, so a sleep-stage segment that started before `now−18h` is dropped outright rather than clipped, silently shrinking the front of a night that started early. This is real and unfixed on `origin/main` today. See "Coordination note — do not duplicate" below: a fix is already in flight, uncommitted, on a sibling branch. |
| Test that locks the closed parts | `services/__tests__/appleHealth.sleepAggregation.test.ts` ("F1 — per-source coverage" and "F2 — same-source value-1 self-coverage" describe blocks, probes g/h/i/j + TAIL/LEAD-IN/MID-GAP fixtures), `services/__tests__/appleHealth.sleepAdapter.test.ts`, `services/__tests__/appleHealth.sleepSelection.test.ts`, `services/__tests__/appleHealth.observedAtNullGuard.test.ts` (sleep's own timestamped-null guard is verified absent-of-bug by inspection — `sleepHoursLastNightObservedAtMs` is only ever set on the success return path, `appleHealth.ts:1219`, mirroring the pattern the other three fields needed a dedicated fix for). |

### Workouts

| Field | Value |
|---|---|
| HealthKit identifier | `HKWorkoutTypeIdentifier` |
| Query window | **None — never queried.** |
| Aggregation | N/A. |
| Transformation | N/A. |
| Downstream consumer | None. `requestAppleHealthPermissions` (`appleHealth.ts:145`) requests READ access to `HKWorkoutTypeIdentifier`, but `AppleHealthSnapshot` (`appleHealth.ts:32-66`) has no workout field and `fetchAppleHealthSnapshot` never calls a workout query — confirmed by reading the full 1364-line file: the only two occurrences of "workout" outside the permission array are the diagnostics label at `appleHealth.ts:1349-1353`, which self-documents the gap verbatim: `reason: 'HKWorkoutTypeIdentifier is authorized ... but fetchAppleHealthSnapshot never queries it — AppleHealthSnapshot has no workout field.'` `aggregateBiometrics` DOES read `workoutMinutesToday`/`strain` for `inferredActivityLevel` when a provider supplies them (`biometricsAggregator.ts:382-384`) — WHOOP/Strava/Garmin can populate these; Apple structurally cannot today. |
| Status | **NEEDS-FOUNDER-RULING** (scope decision, not a bug — over-collecting a permission for an unimplemented feature is itself worth a ruling on whether to implement, defer, or narrow the permission request). |
| Test that locks it | None needed — the gap is self-documented in the diagnostics payload rather than silently omitted, which is the honest behavior this program requires. |

---

## 2. Cross-cutting concerns

### Freshness / `observedAt` (sync-recency vs. observation-recency)

**Status: LOCKED for `apple_health` — the mission brief's premise on this point is FALSE as of this SHA. See §3.**

`AppleHealthSnapshot.latestObservedAtMs` (`appleHealth.ts:55-65`) IS produced: it is
`max(restingHeartRateObservedAtMs, hrvSdnnObservedAtMs, sleepHoursLastNightObservedAtMs,
stepsTodayObservedAtMs)`, computed at `appleHealth.ts:1248-1256`, and is genuinely
observation-recency (each per-field time is the underlying HealthKit sample/interval/bucket's own
end time), with one honestly-documented exception: the steps raw-sum fallback path stamps `now`
because a rolling day-aggregate has no single "last observed" instant to point to
(`appleHealth.ts:1099-1100`). `utils/biometricsAggregator.ts`'s `resolveComparisonAxis`
(`biometricsAggregator.ts:189-199`) arbitrates freshness in three tiers — per-field observed time
first, snapshot-level `latestObservedAtMs` second, `fetchedAt` last — and Apple populates tier 1
for all four fields. This was added by "RC-2 Founder Ruling C" / "#562 part 2" (commits `f143d37e`,
`eb910303`) and is explicitly documented as closed in
`docs/health/validation/runbook-apple-healthkit.md`'s "Deviation register" (top of file) and "Known
gaps" section (line 163 onward): *"apple_health's half CLOSED 2026-08-06."* **`samsung_health`
(Health Connect) has no client-side wiring at all and remains genuinely open** — that half of #562
is correctly still registered as open in the same runbook; do not read Apple's closure as closing
the whole gap.

**Test that locks it:** `services/__tests__/appleHealth.observedAtNullGuard.test.ts` (three
`snapshot.latestObservedAtMs` assertions proving the max-of-four computation and that a
null-quantity sample never pollutes it) — this test exists specifically because an earlier draft of
the same feature DID fabricate timestamps for null metrics, so its presence is meaningful evidence,
not incidental coverage.

**What remains open under this bullet:** the runbook itself says device verification of this
closure has not happened — "code-complete and unit-tested... but NOT yet device-verified
end-to-end." That is exactly Build-49's job; see the device protocol document, item 4.

### Sample-vs-average semantics

**Status: OPEN, NEEDS-FOUNDER-RULING.** Confirmed unchanged: `mostRecentQuantitySample`
(`appleHealth.ts:930-939`) queries `ascending: false, limit: 1` — the single newest sample
HealthKit has — for both RHR and HRV. The Health app's headline numbers for these metrics are
typically a daily average or range, not the single most recent instantaneous sample. This is not a
bug (HealthKit is doing exactly what was asked); it is a genuine semantics choice that changes what
the score consumes if reversed (switching to `queryStatisticsForQuantity(['discreteAverage'])`
would change the values feeding `computeRecoverySignal`'s clamp), and `docs/health/validation/
APPLE-PIPELINE-AUDIT.md` §4 already named this as needing a founder ruling before any change. No
new evidence this session changes that disposition. Build-49's device protocol (item 3) is designed
to give the founder the concrete comparison numbers that ruling needs.

### Cross-source merge (steps + sleep)

**Status: LOCKED (steps) / LOCKED for double-counting, OPEN for window-truncation (sleep).** See
the per-metric rows above. Both use the same design principle — client-side reconstruction of a
preferred-source total via bucketing (steps) or per-source coverage spans (sleep) — documented at
length in both files' header comments and independently tested without depending on any assumption
about HealthKit's own internal merge algorithm (which is unverifiable from source, per the Apple
Frameworks Engineer citation in `APPLE-PIPELINE-AUDIT.md` §3).

### `hrvSdnn` vs. the honest `hrvSdnnMs` field

**Status: OPEN, NEEDS-FOUNDER-RULING (named for completeness, not new this session).**
`buildAppleHealthProviderSnapshot` (`biometricsAggregator.ts:326-343`) writes Apple's HRV value into
the legacy `hrvSdnn` field (`biometricsAggregator.ts:336`), which `types/biometrics.ts`
(re-exporting `@workspace/health-core`) documents as `@deprecated` and populated with RMSSD by
WHOOP/Oura/Garmin — Apple is the one provider whose value would be honestly SDNN in the newer
`hrvSdnnMs` field, but nothing writes it there. This does not affect scoring correctness today
(Apple's SDNN value sits in the field the aggregator actually reads), so it is a labeling-honesty
debt, not a functional defect. **I did not touch this**: the write site is inside
`buildAppleHealthProviderSnapshot`, which lives in `utils/biometricsAggregator.ts` — a hard
off-limits file for this task regardless of the fix's simplicity.

---

## 3. Claims from the mission brief proved FALSE this session

1. **"Apple has no `latestObservedAtMs` producer (sync-recency, not observation-recency) — the
   registered #562 gap."** — **FALSE.** Closed on 2026-08-06 (commits `f143d37e`, `eb910303`,
   documented in `runbook-apple-healthkit.md`'s deviation register and "Known gaps" section). Only
   `samsung_health`'s half of #562 remains open. See §2 above for full evidence.
2. **Sleep "13.33h-from-49-samples double-count... fixed via an interval-arbitration chain through
   #623. Determine whether that is complete or still has open edges."** — Partially confirmed,
   partially not: the double-counting defect IS fixed and locked (F1/F2). But a SEPARATE edge —
   the fixed 18-hour query window silently dropping (not clipping) sleep segments that started
   before the window boundary — is still open on `origin/main` at this SHA. This is a real open
   edge, not a false claim, but the brief's framing ("determine whether... complete") undersold how
   much is still open: there is a second, independent, unfixed defect in the same subsystem, not
   just a residual polish item.

No other brief claims were found false; the resting-HR-unconsumed, workouts-never-queried,
stepsNativeMerged-not-selected, and sample-vs-average items all held up exactly as described.

---

## 4. Coordination note — do not duplicate (read before doing anything to sleep)

A second, **uncommitted** worktree (`fix/rc2-sleep-session-window`, observed at
`.claude/worktrees/fix-rc2-sleep-session-window`, last modified 2026-08-07 ~23:09, i.e. actively
being worked concurrently with this session) already contains a substantial, well-tested fix for
the exact 18-hour-window defect named above: it widens the query window to `FRESHNESS_WINDOWS.
sleep.staleAfterMs` (36h, reused from `config/hydroStateModel.ts` rather than a second hardcoded
literal) and adds session-clustering (`clusterSleepIntervalsIntoSessions` /
`chooseSleepSession`, with two new named constants `SLEEP_SESSION_SPLIT_GAP_MS` /
`SLEEP_PRIMARY_SESSION_MIN_MS`) so a widened window spanning last night AND a nap (or two
disjoint sessions) doesn't silently merge them into one inflated total. It is dated internally as a
"founder-ruled 2026-08-08" change and is not yet merged as of this ledger.

**This ledger deliberately does NOT incorporate, depend on, or duplicate that branch's fix.** It is
someone else's uncommitted work in a sibling worktree — not verified, not reviewed, and not mine to
claim. The sleep row above is marked OPEN against what is actually merged on `origin/main` today.
**Recommendation:** the founder should let `fix/rc2-sleep-session-window` land on its own PR before
any other branch (including a future Gate-1 follow-up) touches `services/appleHealth.ts`'s sleep
section again, to avoid a conflict between two independently-written fixes for the same defect.

---

## 5. Summary counts

| Status | Count | Items |
|---|---|---|
| **LOCKED** | 5 | HRV; steps silent-zero fallback (B1.3 + SF-2); sleep cross-source/same-source double-counting (F1/F2); Apple `latestObservedAtMs` / observation-freshness; workouts gap (self-documented, not silently omitted, so counted as a locked *disclosure*, not a locked *feature*) |
| **OPEN** | 2 | Steps three-way selection (Gate 3 — device evidence required); sleep 18h-window truncation (fix in flight elsewhere, uncommitted, not this branch) |
| **NEEDS-FOUNDER-RULING** | 4 | Resting HR unconsumed by scoring; workouts never queried (scope); sample-vs-average semantics (RHR/HRV); `hrvSdnn`/`hrvSdnnMs` labeling honesty debt |

Gate 1 ("health-data correctness locked") is **not fully closeable from this session alone**: two
items are legitimately OPEN pending device evidence (Gate 3, this ledger's steps row) or a
sibling branch's merge (sleep window), and four items are scope/semantics questions that
require the founder, not more engineering, to close. Everything that could be verified,
locked, or corrected without a ruling or without duplicating in-flight work has been.
