# E1 — Cinematic Home · Completion Report

**PHASE:** E1 — Cinematic Home (first phase of the Elite Experience elevation; see
`docs/ui/AFORCE_OS_ELITE_EXPERIENCE_AUDIT.md`).

**STATUS:** Complete. Presentation-only, behind a default-OFF flag. Ships as its own PR.
E2–E4 not started.

**SCOPE DELIVERED:** arc **ring reveal**, truthful **score count-up** (previous→current,
never from zero), **band-tinted accent** (arc + state pill), **adaptive presentation
resolver** (accent + signal ordering per band), **staggered entrance**, and a full
**reduced-motion** branch — all gated by `elite_home_experience_enabled`.

**FILES CREATED**
- `components/home/homePresentation.ts` — pure, presentation-only resolver (band→accent,
  signal order) + motion-decision functions (`resolveArcAnimation`).
- `components/home/__tests__/homePresentation.test.ts` — 12 unit tests.
- `exports/elite-home/` — before/after captures (`before-after.png` + per-state PNGs).
- `docs/ui/AFORCE_OS_ELITE_E1_COMPLETION.md` — this report.

**FILES MODIFIED**
- `components/home/HomeScreenV2.tsx` — flag-gated elite branch (arc animate + accent,
  count-up numeral, accent state pill, band-ordered signals, entrance stagger). **Flag OFF
  path is byte-for-byte the shipped Home.**
- `components/ui/AFReadinessArc.tsx` — opt-in `animate` prop (ring reveal via Reanimated,
  reduced-motion aware). **Default `animate={false}` render is unchanged.**
- `featureFlags/flags.ts` — new flag in `DEFAULT_FLAGS` (`false`) + `DEMO_ALL_ON_FLAGS` (`true`).
- `types/index.ts` — `elite_home_experience_enabled: boolean` on `FeatureFlags`.
- `store/__tests__/_fixtures.ts` — added the new key to the full-literal `baseFlags` fixture (type parity).
- `vitest.config.ts` — include `components/home/__tests__/**` so the new tests run.

**FEATURE FLAGS:** `elite_home_experience_enabled` — **default OFF** in production
(`DEFAULT_FLAGS`), **ON** in `DEMO_ALL_ON_FLAGS`. Read via `useFeatureFlags()`. No dead code
path: OFF renders the exact shipped Home; ON renders the elevated Home.
_Naming note:_ the audit/brief named it `ELITE_HOME_EXPERIENCE_ENABLED`; I used the
lowercase `elite_home_experience_enabled` to match the existing `FeatureFlags` interface
convention (`spec_home`, `guardian_intelligence_enabled`, …).

**PROTECTED FILES TOUCHED:** **None.** `utils/scoringEngine.ts`, `theme/statusColor.ts`,
the Evidence Engine (`utils/scoring/commandEvidence.ts`, `utils/intelligence/*`),
entitlement/`AFPrice`/pricing, and `config/hydroStateModel.ts` are all untouched. The band
accent is sourced from the brand palette in `theme/afTokens.ts` (`af.green/cyan/amber/red`);
DEPLETED uses brand Signal Red `#C1281B`, deliberately **not** statusColor's `#FF2800`
(pinned by a test).

**REAL DATA CONNECTIONS:** Reads the same live engine values the shipped Home already
consumes — `engine.score`, `engine.performanceState.level`, `engine.command.action/explanation`,
`userState`. **No new data, no score/command computation.** The count-up animates only between
two real score values.

**PREVIEW-ONLY FEATURES:** The entire elite experience is preview-only until QA (flag OFF in
the production binary).

**TESTS ADDED:** 12 (`homePresentation.test.ts`) — band→accent mapping; DEPLETED≠`#FF2800`;
signal ordering; presentation-only invariant (resolver returns no score/command); and the
motion decisions: reveal-only-when-eligible, flag-off = no motion, reduced-motion bypass,
never-count-from-zero on first mount, no-animate on stale/non-finite score, no-count-up when
unchanged.

**TEST RESULTS:** 12/12 new pass. Full `artifacts/aforce-os` suite: **2408 passed**. tsc: **0
errors**. (13 `services/__tests__/*` files fail to load in the node vitest env with a
react-native Flow-type transform error — **pre-existing**, verified identical on clean `main`
@ `3ebcb782`; unrelated to E1.)

**VISUAL QA:** `exports/elite-home/before-after.png` (+ per-state PNGs), Standard 390×844:
- Balanced: `before` red arc + plain red "BALANCED" → `after` **cyan arc + cyan "BALANCED"
  pill**. Score `76`, command "Drink 12oz water", signals identical.
- Depleted: `after` **Signal Red arc + red "DEPLETED" pill**. Score `38`, command "Drink 20oz
  water now", identical data. (Depleted keeps brand red by design — the visible delta is the
  pill; the arc-color drama is the balanced case.)
- Reduced-motion: `after-balanced-reduced-motion.png` is byte-identical to the animated final
  frame (accent + pill intact, animation disabled) — the honest expected behavior.

**ACCESSIBILITY:** Arc keeps `accessibilityRole="progressbar"` + `accessibilityValue`. The
state pill inherits readable text (accent paired with the band word, never color-alone). A
**new reduced-motion branch** collapses ring reveal, count-up, and entrance to the static
Home (`useReducedMotion` + `resolveArcAnimation`) — the static Home had no motion to gate
before.

**PERFORMANCE:** Reanimated (already a dependency). All animations are one-shot on mount
(ring reveal 750ms, count-up 900ms, entrance stagger 90ms/step) on the UI thread; nothing
loops; reduced-motion path runs zero animations. No JS-thread-blocking work; no layout
thrash.

**KNOWN GAPS / DEFERRED (per audit):**
- "Updated just now" freshness is still hardcoded — **blocked-by-data**, deferred.
- Confidence/calibration sub-state not surfaced yet — deferred.
- Depleted's elite delta is the pill + motion (arc stays brand red by design).
- Component-level render tests aren't added (the repo's vitest runs node/pure only); the
  motion/presentation **decisions** are covered via extracted pure functions instead.

**COMMIT:** _(see PR)_
**PR:** _(see PR)_
