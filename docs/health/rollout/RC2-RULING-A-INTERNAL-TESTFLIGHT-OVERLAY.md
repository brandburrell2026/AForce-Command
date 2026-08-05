# RC-2 Ruling A — Internal-TestFlight Elite-Flag Overlay

**Status:** Built. Scope: TestFlight (internal distribution) only.
**Ruling:** Brandon, orchestrating chat, RC-2 Ruling A — "Enable the four
`elite_*` flags and `offline_intake_outbox_enabled` in the internal TestFlight
configuration. Do not change production defaults." Commander attests;
Brandon's PR approval is the final gate.
**Off-limits respected:** no edit to `scoringEngine.ts` or `statusColor.ts`;
`DEFAULT_FLAGS` and `DEMO_ALL_ON_FLAGS` in `featureFlags/flags.ts` are
byte-identical to `main` (this doc's overlay module is additive, and the one
call site it patches — `store/useAppStore.tsx`'s `initialState.featureFlags`
— is proven a no-op reference pass-through when the gating env is unset; see
Proof below). `eas.json` is untouched in this PR — the profile that would set
the gating env is a **proposed diff only**, reproduced in full in the PR body,
pending Brandon's explicit approval of that exact diff.

## The five flags

| Flag | `DEFAULT_FLAGS` today | Under the overlay |
|---|---|---|
| `elite_motion_enabled` | `false` | `true` |
| `elite_home_experience_enabled` | `false` | `true` |
| `elite_weekly_report_enabled` | `false` | `true` |
| `elite_voice_coach_enabled` | `false` | `true` |
| `offline_intake_outbox_enabled` | `false` | `true` |

All five are presentation/delivery-only or additive-durability flags per their
own doc comments in `featureFlags/flags.ts` (Score-Protection: none reads
into, awards, or mutates score/command/dose/timing/safety). None appears in
`INTERNAL_PREVIEW_RESTRICTED_FLAGS` (`['night_out_enabled']`) — verified by
test (`featureFlags/__tests__/internalTestflightOverlay.test.ts`), so this
overlay cannot be used as a side-door around the NO-10 restriction.

## The seam

Investigated before building (per the ruling's instruction):

- `featureFlags/flags.ts` exports two static flag sets, `DEFAULT_FLAGS`
  (production) and `DEMO_ALL_ON_FLAGS` (investor/pitch demo). Neither is
  edited by this change.
- `store/useAppStore.tsx`'s module-level `initialState.featureFlags` read
  `DEFAULT_FLAGS` directly (line ~145 pre-change) — this is the ONE seam that
  determines what flags an `AppProvider` boots with. Every other
  `DEFAULT_FLAGS` consumer in the app (`app/_layout.tsx`,
  `app/(tabs)/_layout.tsx`, `services/appleHealth.ts`, the Profile "unlock
  all" affordance) reads the constant directly for its own non-store gate
  (native tabs, HealthKit, Clerk token cache) and is intentionally left alone
  — RC-2 Ruling A is about the app's runtime feature-flag state, not those
  compile-time/native gates.
- `services/demoMode.ts`'s `DEMO_MODE` constant (`EXPO_PUBLIC_DEMO_MODE ===
  'true'`) is the existing precedent for an env-driven, build-profile-gated
  switch: unset on every normal build, so the branch it guards is provably
  unreachable outside a deliberate build.
- `featureFlags/internalPreviewOverlay.ts` already exists but is a **different,
  unrelated** mechanism (server-driven, per-user cohort grant with a 15-minute
  TTL and contract versioning, dead code pending its own PR series). This
  ruling's overlay does not reuse or extend it — reusing that module's
  allow-list/TTL/contract machinery for a static, build-time, all-users
  overlay would be over-engineering for what this ruling actually asks for.
- `eas.json` has `development`, `preview`, `demo` (extends `preview`, sets
  `EXPO_PUBLIC_DEMO_MODE=true`), and `production` build profiles. There is no
  `internal` profile today — see the PR body for the proposed one.

## What was built

- `featureFlags/internalTestflightOverlay.ts` — new module:
  - `INTERNAL_TESTFLIGHT_OVERLAY_FLAGS`: the exact five keys, in the ruling's
    order.
  - `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`: `process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT']
    === 'true'` — mirrors `DEMO_MODE`'s pattern exactly.
  - `applyInternalTestflightOverlay(base, engaged)`: pure, injectable-`engaged`
    function. Returns `base` **by reference** when `engaged` is falsy (the
    production/App-Store path); returns a new object with exactly the five
    keys unioned to `true` when `engaged` is true. Never sets a flag to
    `false`; never mutates `base`.
  - `resolveInitialFeatureFlags(base)`: the sanctioned call site for
    `useAppStore`'s initial state.
- `store/useAppStore.tsx`: `initialState.featureFlags` now reads
  `resolveInitialFeatureFlags(DEFAULT_FLAGS)` instead of `DEFAULT_FLAGS`
  directly. `DEFAULT_FLAGS` itself is untouched and still imported/exported
  unchanged for every other consumer.

## Proof (identity + exactly-five)

`featureFlags/__tests__/internalTestflightOverlay.test.ts` (12 tests, all
passing):

- **Identity when off** — `applyInternalTestflightOverlay(DEFAULT_FLAGS,
  false)` returns `DEFAULT_FLAGS` by `toBe` reference equality (not just deep
  equality); `resolveInitialFeatureFlags(DEFAULT_FLAGS)` does the same, and a
  before/after key-diff against `DEFAULT_FLAGS` is asserted empty (`[]`).
  `DEFAULT_FLAGS` itself is asserted unmutated by the call. The default
  `engaged` argument (reading the real env constant) is exercised too — in
  this repo's test environment `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` is unset, so
  it resolves to the identity path, same as every CI/App-Store build.
- **Exactly five when on** — a full key-diff between `DEFAULT_FLAGS` and
  `applyInternalTestflightOverlay(DEFAULT_FLAGS, true)` is asserted to equal
  exactly the five ruling keys (sorted), nothing more, nothing less. A
  separate test proves the union semantics (an already-true unrelated flag in
  `base` survives untouched, and the diff is still exactly the five keys) and
  idempotency (applying twice yields the same five-key diff as once).
- **No restricted-flag interaction** — none of the five keys appear in
  `INTERNAL_PREVIEW_RESTRICTED_FLAGS`.
- Full `featureFlags/**` suite: 69/69 passing. `store/**` suite (touched by
  the `useAppStore.tsx` wiring): 116/116 passing. `artifacts/aforce-os`
  typecheck: clean (`tsc -p tsconfig.json --noEmit`, zero errors).

## Explicitly out of scope for this PR (per the ruling)

- **Production flip.** Ruling A is TestFlight only. Flipping any of the five
  flags in `DEFAULT_FLAGS` (production) or shipping this overlay engaged on
  the `production` EAS profile requires, per the ruling's own framing, a
  separate decision with: device QA pass (all five surfaces, iOS + Android),
  accessibility review (reduced-motion path for `elite_motion_enabled`,
  screen-reader pass for the voice-coach eyebrow copy under
  `elite_voice_coach_enabled`), performance budget check (motion/shimmer cost
  on lower-end devices), and a stated rollback criterion (which metric
  regressing triggers reverting the flip, and how — this overlay's `false`
  path is the rollback: unset the env, next build is byte-identical to today).
- **`eas.json` edit.** Flag-first per standing founder rule. The profile that
  would set `EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true` is proposed as a diff in
  the PR body only; `eas.json` on this branch is byte-identical to `main`.
- **Any change to `DEFAULT_FLAGS` or `DEMO_ALL_ON_FLAGS` values.** Confirmed
  unchanged by this PR (git diff shows zero lines touched in `flags.ts`).
