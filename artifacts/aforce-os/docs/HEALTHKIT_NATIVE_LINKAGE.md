# HealthKit Native Linkage — Embedded vs. Available vs. Activated

_Status: reference doc, ships with `fix/health-honesty-mappers`. Describes what
actually changes (and doesn't) when the HealthKit dependency pins land, and the
gate that must sit between "it's in package.json" and "it ships." Companion to
`docs/HEALTH_PLATFORM_INTEGRATION_ARCHITECTURE.md` (provider-honesty architecture)
— this doc is narrower: the mechanics of one native module's build lifecycle._

## 1. The three states, precisely

Three questions get conflated constantly on native-module work. They are
answered by three **different mechanisms**, at three **different times**, and
none of them implies the others:

| State | Question | Answered by | Changes when |
|---|---|---|---|
| **Embedded** | Is the JS package in `package.json` / installed in `node_modules`? | `pnpm-lock.yaml` | `pnpm install` runs against a new `package.json` |
| **Linked** | Is the native code (the Nitro module, iOS pods/frameworks) compiled into THIS binary? | The **build artifact** (the `.app`/`.ipa` produced by an EAS build or local `expo run:ios`) | A **new native build** runs — never at runtime, never by editing JS |
| **Activated** | Does the app actually CALL into the native module at runtime? | `DEFAULT_FLAGS.healthkit_native_enabled` (`featureFlags/flags.ts`) + `Platform.OS === 'ios'`, gated in `services/appleHealth.ts`'s `isAppleHealthSupported()` / `loadHealthKit()` | A flag flip ships in a new JS bundle (OTA update or new build) |

**These are independent axes.** A build can be Linked but not Activated
(flag off — the shipped `.app` has the module compiled in but never touches
it). A dependency can be Embedded without being Linked (package.json lists it,
but the last EAS build predates that change, so the running binary doesn't
have the native code at all — calling into it would crash). Activated without
Linked is not a state that can occur safely: the flag-gate in
`services/appleHealth.ts` exists specifically so a flag flip can never reach a
binary that lacks the native code (see §3).

## 2. What THIS PR changes, and what it deliberately does not

This PR (`fix/health-honesty-mappers`) exact-pins two dependency versions in
`artifacts/aforce-os/package.json`:

```
"@kingstinct/react-native-healthkit": "14.0.2"      (was ^14.0.2)
"react-native-nitro-modules": "0.35.10"             (was ^0.35.10)
```

This is an **Embedded**-layer change ONLY. It changes:
- `pnpm-lock.yaml` (resolved via `pnpm install --lockfile-only`)
- What version `pnpm install` will fetch into `node_modules` next time anyone
  installs

It does **NOT** change:
- **Linked** state — no native build runs as part of a dependency-pin commit.
  Whatever iOS binary is currently in TestFlight/production keeps whatever
  native code it was built with, unaffected by this merge.
- **Activated** state — `DEFAULT_FLAGS.healthkit_native_enabled` is untouched
  by this PR. `services/appleHealth.ts`'s dormancy contract (see
  `services/__tests__/appleHealth.test.ts`) still holds: every exported
  function resolves to a safe "unavailable" result and the dynamic
  `import('@kingstinct/react-native-healthkit')` is never reached.

**Why pin exactly, if nothing runtime-visible changes today?** Because a
caret range (`^14.0.2`) lets a routine `pnpm install` silently resolve to
`14.x` months from now, changing what a FUTURE build links in without anyone
deciding to. For a native module gating real health data honesty (this
adapter's whole reason for existing), "what native code will actually get
compiled in" must be a deliberate, reviewable decision — a version bump in a
diff — not a side effect of whenever someone next runs install. Exact pins
make the Embedded state match a specific, audited version until a human
changes it on purpose.

## 3. Why no dynamic unlinking, and no auto-activation

There is no code path anywhere in this app that:
- Detects "the native module happens to be present" and activates on that
  basis, or
- Flips `healthkit_native_enabled` based on anything other than an explicit,
  reviewed flag change.

This is deliberate, not an oversight. `loadHealthKit()` in
`services/appleHealth.ts` checks the flag FIRST and returns `null` before
ever attempting the dynamic `import()` — so a binary that was never
rebuilt with the native code linked, but somehow got the flag flipped on
via an OTA JS update, still never calls into it. The flag is a runtime gate
on top of a build-time fact; it can only ever narrow behavior (turn a
linked capability off), never manufacture a native capability that isn't
compiled into the binary.

Concretely: flipping `healthkit_native_enabled: true` is safe ONLY the
moment after a build that included these exact pinned native dependencies.
Flipping it via an OTA update against an OLDER binary that predates the
native linkage would be attempting to activate a capability the binary
doesn't have — this can't silently "half work"; the dynamic import throws
inside `loadHealthKit()`'s own `try/catch` and is swallowed to `null`
(logged via `console.warn`), so the failure mode is "HealthKit silently
stays unavailable," not a crash — but it is still a gap between what the
flag claims and what the binary can do, and it must not happen by accident.

## 4. The gate: mobile-release-manager owns the smoke-build check

Before `healthkit_native_enabled` is ever flipped `true` for any build
channel (dev, preview, or production), **mobile-release-manager** must
confirm, for that specific build:

1. The build was produced AFTER the dependency-pin change landed (i.e. this
   PR, or later — check the build's commit SHA against this PR's merge SHA).
2. The build is a genuine native build (EAS build or local
   `expo run:ios`/`pod install` cycle) — not a JS-only OTA update layered on
   an older native binary.
3. A smoke test on that exact build artifact confirms:
   - The app launches without a TurboModule/Nitro-module linkage crash
     (the class of failure this repo has hit before with native module
     version drift — see the pinned `react-native` 0.81.5 patch note in
     `CLAUDE.md`'s stack facts).
   - `requestAppleHealthPermissions()` reaches the real HealthKit
     authorization sheet (proves the native module actually linked, not
     just that JS didn't crash).

Only after that smoke-build gate passes does flipping the flag for that
build channel become a normal, reviewable config change. This is a
one-directional gate — build-then-verify-then-flip — never
flip-then-build, and never "flip because the dependency pin merged."

## 5. Quick-reference: per-metric HealthKit semantics

Consolidated from the in-code JSDoc in `services/health/appleHealthRecords.ts`
(source of truth — this table is a summary, not a substitute):

| Canonical metric | HK identifier | Unit passed in | Notes |
|---|---|---|---|
| `resting_heart_rate` | `HKQuantityTypeIdentifierRestingHeartRate` | bpm | One record per sample, no aggregation |
| `hrv` | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | ms | Unconditionally `hrvMethod: 'sdnn'` — Apple's HRV type is SDNN, never RMSSD; no code path can emit `'rmssd'` |
| `steps` | `HKQuantityTypeIdentifierStepCount` | count | One record per sample interval; no daily aggregation performed here |
| `active_energy` | `HKQuantityTypeIdentifierActiveEnergyBurned` | kcal | One record per sample |
| `respiratory_rate` | `HKQuantityTypeIdentifierRespiratoryRate` | breaths/min | One record per sample |
| `workout` | `HKWorkoutTypeIdentifier` | n/a (structured `WorkoutValue`) | `activeEnergyKcal`/`avgHeartRateBpm` stay `null` when absent, never `0` |
| `sleep_session` | `HKCategoryTypeIdentifierSleepAnalysis` | n/a (structured `SleepSessionValue`) | See §5a |

All quantity/workout mappers drop (not throw on) any sample whose
`startDate`/`endDate` doesn't parse to a valid date — see `toIsoUtc`'s
null-return contract in `appleHealthRecords.ts`.

### 5a. Sleep — `HKCategoryValueSleepAnalysis` numeric values

`inBed=0, asleepUnspecified=1, awake=2, asleepCore=3, asleepDeep=4, asleepREM=5`.

- `totalSleepHours` = sum of durations where value ∈ {1,3,4,5}. Never
  includes `0` (inBed) or `2` (awake).
- `inBedHours` = sum of durations where value `=== 0`, **only when at least
  one such sample is present** for that source; otherwise `null`. Never
  derived by summing asleep+awake — HealthKit's flat sample list asserts no
  overall coverage, so that sum would assume continuity the data doesn't
  promise.
- Records are grouped by `sourceRevision` bundle id — one `sleep_session`
  record per source per call, so an Apple Watch night and a same-night Oura
  re-export land as two honestly-attributed records (collapsed later by
  `dedupeRecords`, not by this mapper).

This is a **deliberately different mechanism** from the Health Connect
adapter's `inBedHours` (session-span-minus-out-of-bed — see
`services/health/healthConnect/mapRecords.ts`'s `mapSleepStages` doc), because
the two platforms assert structurally different things: HealthKit has no
session container, Health Connect's `SleepSessionRecord` span IS the
platform's own definition of the tracked sleep episode. Same honesty
standard, different evidence available — not an inconsistency.
