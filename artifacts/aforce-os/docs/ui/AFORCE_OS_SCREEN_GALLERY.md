# AForce OS — P0 Screen Gallery

Companion doc for the P0 deliverable in `docs/ui/AFORCE_OS_VISUAL_AUDIT.md` §8:
*"a deterministic screen gallery rendering the shipped `…ScreenV2` surfaces in
fixed states for side-by-side diffing against the refs."*

Status: **dev/demo-only harness.** It is not a product surface, ships no new
user-facing feature, and is unreachable in a production build (see Guardrails
below).

## What it is

`demo/AForceScreenGallery.tsx` renders 13 deterministic states of the app's
real, shipped `…ScreenV2` components (and two prop-driven surfaces) — never a
fork, never a re-styled copy. Each state is driven purely through the same
mechanisms the app already uses to represent state: a store snapshot (feature
flags + a hand-built `AppState`) for context-driven screens, or a direct prop
for screens that are already pure/presentational.

Reachable at the `/gallery` route (file: `app/(hidden)/gallery.tsx`) only when
`__DEV__` is true or `EXPO_PUBLIC_DEMO_MODE=true`. Every other build redirects
`/gallery` to `/`.

## How to open it

1. Run the app in a normal Expo dev build (`__DEV__` is true automatically),
   **or** an internal demo profile with `EXPO_PUBLIC_DEMO_MODE=true`.
2. Navigate to `/gallery` (e.g. `expo-router`'s dev menu, a deep link, or
   `router.push('/gallery')` from another dev-only surface).
3. Tap a state in the index list to open it in the viewport frame.

## Viewport presets

Selectable at the top of the detail view (`AFSegmentedControl`), matching the
spec's three reference sizes:

| Preset | Width × Height |
|---|---|
| iPhone SE | 375 × 667 |
| Standard | 390 × 844 |
| Large | 430 × 932 |

**What the frame is, honestly:** a fixed-size, bordered `View` that clips and
centers the rendered screen — a device-frame *mockup*, the same idea as a
browser's device toolbar or a Storybook viewport addon. It is **not** a true
device-size emulation: React Native's `useWindowDimensions()` /
`SafeAreaProvider` insets read the actual app window, not an ancestor View's
size, so a screen's own internal responsive breakpoints (e.g.
`useResponsiveLayout()`) still respond to the real simulator/device window,
not the selected preset. Use the preset to compare content width and framing
at a glance; for a pixel-true breakpoint check, resize the simulator/device
itself.

## Screenshot capture

No new tooling is introduced. Use whatever the team already uses for a given
target:
- **iOS Simulator:** `Cmd+S` (Simulator menu → Device → Screenshot), or
  `xcrun simctl io booted screenshot out.png`.
- **Physical device / Expo Go:** the OS screenshot gesture.
- **Web preview:** the browser's own screenshot/devtools capture.

Name captures `<fixture-id>--<viewport-id>.png` (e.g.
`home-depleted--standard.png`) so they sort next to the fixture list below and
diff cleanly against `design/aforce-os-reference/` once those 21 images land.

## The 13 states

| # | id | Screen | Driven by |
|---|----|--------|-----------|
| 1 | `home-depleted` | `HomeScreenV2` | `engineOutput.score=38` (DEPLETED band, 0-59 per `utils/scoringEngine.ts`) + low-intake/high-heat `userState` overrides; `flags.spec_home=true` |
| 2 | `home-balanced` | `HomeScreenV2` | `engineOutput.score=76` (BALANCED band, 75-89) + the same tuned `defaultUserState` the app ships; `flags.spec_home=true` |
| 3 | `hydration-empty` | `HydrationScreenV2` | `userState.intakeEvents=[]`, `ozConsumedToday=0`, `complianceStreak=0`; `flags.spec_hydration=true` |
| 4 | `hydration-populated` | `HydrationScreenV2` | `userState.intakeEvents` = 5 logged events spread across today; `flags.spec_hydration=true` |
| 5 | `command-active` | `RecoveryCoachScreen` | `RecoveryCommand.state='active'` passed directly as the `command` prop (pure-props screen, no store) |
| 6 | `command-completed` | `RecoveryCoachScreen` | `RecoveryCommand.state='complete'` |
| 7 | `guardian-eligible` | `app/guardian.tsx` | `flags.guardian_intelligence_enabled=true` + `engineOutput.score=8`, which drives the screen's own `guardianRiskScore()` call (read-only consume of `utils/scoring/recommendations.ts`) past the 75-point CRITICAL threshold |
| 8 | `guardian-not-eligible` | `app/guardian.tsx` | `flags.guardian_intelligence_enabled=false` — renders the real `FeatureGate` "DEMO LOCKED" quiet state |
| 9 | `calibration-limited-data` | `VoiceCheckInOverlay` | Mounted directly at its first step — pure-props screen, no store |
| 10 | `offline` | `RecoveryCoachScreen` | The screen's real `offline` prop set `true`, with a still-valid cached `acknowledged` command |
| 11 | `permission-denied` | *(approximated — see Limitations)* | Composed from existing `AF*` primitives (`AFEmptyState`, `AFErrorState`) |
| 12 | `activation-failure` | `ManageSubscriptionScreenV2` | `subscription.status='past_due'` (a real `SubscriptionStatus` value) — renders the screen's existing amber status pill |
| 13 | `activation-success` | `ManageSubscriptionScreenV2` | `subscription.status='active'` — renders the screen's existing green status pill |

Exact field-level values live in `demo/galleryFixtures.ts` — each fixture
carries a `driver` string with the precise store fields / props that produce
it, shown inline in the gallery's detail header.

## How a fixture is applied (no new state-management pattern)

- **Store-driven screens** (`home`, `hydration`, `guardian`, `activation`):
  the gallery nests a fixture-scoped `<AppContext.Provider>` +
  `<SliceProvider>` — the exact same context objects `AppProvider` uses
  app-wide — around just that screen. React context resolves to the nearest
  provider, so the live app's real `AppProvider` (mounted once at the root
  layout) is shadowed for that subtree only. No network call, no timer, no
  AsyncStorage write ever fires from a fixture render.
- **Prop-driven screens** (`RecoveryCoachScreen`, `VoiceCheckInOverlay`):
  the fixture is passed straight in as a prop, exactly as production does.
- Every store-driven fixture's actions (`logIntake`, `setFeatureFlags`, …) are
  wired to no-ops — the gallery is inspection-only and must never mutate real
  state, log real intake, or speak (voice is force-muted).

## Limitations (documented honestly, not fabricated)

- **`permission-denied`** has no first-class existing screen. This repo's
  `services/healthConnection.ts` defines a `denied` `ConnectionStatus`, but
  its own header says *"Build only. No UI … wires this module today."* The
  shipped Health Platforms card only distinguishes flag-on/connected vs.
  flag-off/not-connected — never a granular OS-level denial. Rather than
  fabricate a new screen or touch entitlement/permission logic to force a
  state that doesn't exist, this fixture composes existing `AF*` primitives
  and is flagged **"Approximated"** in the gallery UI.
- **Camera surfaces are excluded.** HydroScan (`scan/HydrationScanScreenV2`)
  is not used for any fixture, per the standing camera-dark-pending-legal
  hard limit — even for a permission-flow demo.
- **Viewport presets are a framing mockup**, not a true device-size
  emulation — see "Viewport presets" above.

## Guardrails

- `demo/galleryFixtures.ts` throws at import time when neither `__DEV__` nor
  `EXPO_PUBLIC_DEMO_MODE` is set — enforced by
  `demo/__tests__/galleryFixtures.guard.test.ts`.
- `app/(hidden)/gallery.tsx` lazy-loads the gallery (`React.lazy` +
  dynamic `import()`) *behind* the same `__DEV__`/demo-mode check, so the
  module is never evaluated on a normal production launch — the redirect
  happens before the import is ever attempted.
- The same guard test statically scans `screens/`, `hooks/`, `services/`,
  and `store/` and fails if anything there resolves an import into `demo/`.
- Nothing in `demo/` edits `utils/scoringEngine.ts`, `theme/statusColor.ts`,
  the Evidence Engine (`utils/intelligence/*`), entitlement/purchase logic,
  or safety/disclaimer copy — every fixture only *reads* those systems'
  existing, exported shapes (e.g. `RecoveryCommandState`, `SubscriptionStatus`)
  or sets in-memory store state built from the app's own real defaults
  (`defaultUserState`, `DEFAULT_FLAGS`, `defaultSubscription()`).
