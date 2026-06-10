---
name: AForce first-run gating
description: How the onboarding → app first-run flow is gated, and why it uses a single completed flag.
---

First-run routing uses ONE AsyncStorage flag: `aforce.hasCompletedOnboarding`
(set only when the onboarding wizard finishes or is skipped). The pure
decision lives in `utils/firstRunRoute.ts` (`FirstRunRoute = '/onboarding'
| null`) and is consumed by `SplashGate` in `app/_layout.tsx` and by
`app/index.tsx`. A cold start before the flag is set lands on `/onboarding`;
once set, it falls through to the tabs.

**Why:** There used to be a separate welcome lobby (`app/welcome.tsx`) with
its own `aforce.hasSeenWelcome` flag, plus a long-dead `aforce.welcomeSeen`
key that `index.tsx` read but nothing ever wrote. The welcome lobby was
removed (owner asked to delete those screens), so the two-flag gate
collapsed to one. The cold-launch cinematic is now solely the
`OpeningSequence` overlay (mounted in `_layout.tsx`, touches no routing).

**How to apply:** Never mark onboarding complete before the wizard's finish
path. `SplashGate` and `index.tsx` must read the SAME key
(`aforce.hasCompletedOnboarding`) so they converge on one destination — the
old bug was them reading different keys. Any new first-run step must extend
`firstRunRoute` (and its test) rather than overloading the flag. DEMO_MODE
wipes the flag every cold start to replay onboarding for pitches.

Onboarding goals are consumer-facing labels mapped 1:1 onto the five
engine `RecoveryGoal`s (PERFORMANCE/RECOVERY/ENDURANCE/BALANCE/LONGEVITY)
— no engine remap. Activity level is captured as `ProfileIdentity.activityLevel`
(0..10) and consumed by the hydration-demand adapter as a Profile-side
override of the server `UserState.activityLevel` (mirrors the body-weight rule).
