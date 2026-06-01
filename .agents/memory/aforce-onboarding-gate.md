---
name: AForce first-run gating
description: How the welcome → onboarding → app first-run flow is gated, and why it uses two flags.
---

First-run routing uses TWO independent AsyncStorage flags, not one:
`aforce.hasSeenWelcome` (set when the user taps CONTINUE on the welcome
lobby) and `aforce.hasCompletedOnboarding` (set only when the onboarding
wizard finishes or is skipped). The pure decision lives in
`utils/firstRunRoute.ts` and is consumed by `SplashGate` in
`app/_layout.tsx`.

**Why:** A single "completed" flag was originally written by welcome
*before* the onboarding wizard ran, so a cold start mid-onboarding
silently skipped setup entirely. Splitting the flags lets an interrupted
first run resume at `/onboarding` instead of falling through to the tabs.

**How to apply:** Never mark onboarding complete from the welcome screen
or before the wizard's finish path. Any new first-run step must extend
`firstRunRoute` (and its test) rather than overloading an existing flag.
DEMO_MODE wipes both flags every cold start to replay the full intro for
pitches.

Onboarding goals are consumer-facing labels mapped 1:1 onto the five
engine `RecoveryGoal`s (PERFORMANCE/RECOVERY/ENDURANCE/BALANCE/LONGEVITY)
— no engine remap. Activity level is captured as `ProfileIdentity.activityLevel`
(0..10) and consumed by the hydration-demand adapter as a Profile-side
override of the server `UserState.activityLevel` (mirrors the body-weight rule).
