# E3 — Premium Motion System · Completion Report

**PHASE:** E3 — Premium micro-interactions & motion (third phase of the Elite Experience
elevation; see `docs/ui/AFORCE_OS_ELITE_EXPERIENCE_AUDIT.md`).

**STATUS:** Complete. Presentation-only; the reusable foundation + one gated adoption. Ships
as its own PR. E4 not started.

**SCOPE DELIVERED:** the motion **foundation** the audit found missing — the `afMotion` tokens
were consumed by nothing, press states were opacity-only, reduced-motion was honored in only 5
files via two mechanisms, and ~60 inline `expo-haptics` call sites had no façade. This adds:
a shared **`useReducedMotion`** hook, a central **`haptics`** façade, the **`AFMotionPressable`**
press primitive (scale + meaningful haptic), an **`AFSkeleton`** shimmer, a `cinematic` motion
tier + press-scale tokens — and adopts the premium press-feel in **`AFButton`**, gated by
`elite_motion_enabled`. Every animation has a static reduced-motion alternative.

**FILES CREATED**
- `components/ui/motionLogic.ts` — pure decisions (`shouldAnimate` / `pressScale` /
  `shouldFireHaptic` / `shimmerEnabled`).
- `components/ui/AFMotionPressable.tsx` — the premium press primitive.
- `components/ui/AFSkeleton.tsx` — branded loading shimmer (self-cancelling).
- `hooks/useReducedMotion.ts` — the single shared reduced-motion signal.
- `services/haptics.ts` — central UI-haptics façade (gated, web-safe, best-effort).
- `components/ui/__tests__/motionLogic.test.ts` — 11 unit tests.
- `app/(hidden)/motion-demo.tsx` — dev/demo-only preview route.
- `exports/elite-motion/` — captures (`motion-demo.png`, `motion-demo-pressed.png`).
- `docs/ui/AFORCE_OS_ELITE_E3_COMPLETION.md` — this report.

**FILES MODIFIED**
- `theme/afTokens.ts` — `afMotion` gains `fast/standard/slow/cinematic` durations + a
  `scale.{rest,pressed}` pair. (Brand values frozen; existing tokens unchanged.)
- `components/ui/AFButton.tsx` — the family now renders through `AFMotionPressable`; with the
  flag on it scales + fires a `selection` haptic on press. **Flag OFF (and reduced-motion) =
  the exact prior behavior** (opacity/tone press only, no scale, no haptic).
- `components/ui/index.ts` — export the two new primitives.
- `featureFlags/flags.ts` / `types/index.ts` / `store/__tests__/_fixtures.ts` — new flag + parity.

**FEATURE FLAGS:** `elite_motion_enabled` — **default OFF** in production, **ON** in
`DEMO_ALL_ON_FLAGS`. Gates the AFButton press-feel/haptic. `AFMotionPressable` /
`AFSkeleton` are reusable primitives (a caller passes `motionEnabled` / `enabled`) — not dead
code: they are consumed by the AFButton adoption and the demo route today.

**PROTECTED FILES TOUCHED:** **None.** `scoringEngine.ts`, `statusColor.ts`, Evidence Engine,
entitlement/`AFPrice`, `hydroStateModel.ts` all untouched. Motion is presentation-only —
Score-Protection unaffected.

**REAL DATA CONNECTIONS:** none — this is pure UI motion. `AFButton` now reads
`useFeatureFlags()` (a context read) to gate the press-feel; confirmed no `AFButton` renders
outside the flags provider (the ErrorBoundary fallback uses a plain `Pressable`).

**PREVIEW-ONLY FEATURES:** the AFButton press-feel/haptic is preview-only (flag OFF in prod);
the demo route is dev/demo-gated.

**TESTS ADDED:** 11 (`motionLogic.test.ts`) — new token values (fast/standard/slow/cinematic +
scale pair); the reduced-motion contract (`shouldAnimate`); press-scale (compresses on press,
**stays at rest when motion is off — never jumps**, honors custom scale); haptics gating
(fires when enabled, never when disabled or under reduce-haptics); shimmer mirrors the motion
gate.

**TEST RESULTS:** full `artifacts/aforce-os` suite **2424 passed** (+11 new); tsc **0 errors**.
(13 `services/__tests__/*` files fail to load in node vitest with a react-native Flow-type
transform error — **pre-existing**, unrelated.)

**VISUAL QA:** `exports/elite-motion/motion-demo.png` (dev/demo `/motion-demo` route) shows the
`AFSkeleton` loading blocks, the AFButton family, and the `AFMotionPressable` card.
`motion-demo-pressed.png` captures the held-press compressed state. **Motion is behavioral** —
the scale/shimmer/haptic don't show in a still, so E3's proof is the primitives rendering + the
11 pure-logic tests + the reduced-motion branches, not a before/after diff.

**ACCESSIBILITY:** `useReducedMotion` is the single shared signal; every new animation checks it
and collapses to a static alternative (press stays at rest; skeleton stops shimmering). Haptics
respect a `reducedHaptics` switch. `AFMotionPressable` forwards `accessibilityRole` /
`accessibilityLabel` / `accessibilityState` so the AFButton family's a11y is unchanged.

**PERFORMANCE:** press-scale is a 120ms UI-thread timing (Reanimated); the skeleton shimmer is a
single repeating opacity tween that **cancels on unmount** (no lingering timers/duplicate
animations). Haptics no-op on web and are best-effort. No JS-thread-blocking work.

**KNOWN GAPS / DEFERRED (to keep this PR controlled):**
- **Branded pull-to-refresh** and an **accessibility settings screen** (reduce-motion /
  reduce-haptics / larger-type) — deferred to a follow-up; the primitives + gates they'd use
  now exist.
- Broader adoption (migrating the ~60 inline `expo-haptics` sites onto the façade; wiring
  `AFSkeleton` into real loading states; tokenizing the remaining hardcoded durations in
  `AnimatedScore`/`RitualRail`/`HeatPulse`/`StatusPulseOrb`) is incremental follow-up.

**COMMIT:** _(see PR)_
**PR:** _(see PR)_
