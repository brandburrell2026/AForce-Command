# AForce OS — Elite Experience Audit (Phase 0)

_Generated 2026-08-01 · read-only audit · no code changed._

Phase 0 of the "make AForce OS elite" elevation pass — a **focused product-elevation**
of four areas (Home, Weekly Report, Motion/micro-interactions, Voice Coach/AI copy),
**not** a whole-app redesign. This document is the gate: **no implementation (E1–E4)
begins until it is reviewed and approved.**

**Parent gate:** this audit inherits from and defers to
[`AFORCE_OS_VISUAL_AUDIT.md`](./AFORCE_OS_VISUAL_AUDIT.md) — the founder-recorded
**extend-not-rebuild** decision: keep the frozen brand v2.2.0 (Signal Red `#C1281B`,
Cinematic Black `#0D0D0D`), extend the shipped `components/ui/AF*` primitives, do
**not** fork a parallel `src/design-system/`, do **not** rebuild screens, and never
touch protected scoring / status-color / Evidence Engine / entitlement / HydroState
logic. Deterministic side-by-side validation uses the dev/demo-only `/gallery`
harness ([`AFORCE_OS_SCREEN_GALLERY.md`](./AFORCE_OS_SCREEN_GALLERY.md)).

**Classification legend:** `already strong` · `needs refinement` · `missing interaction` ·
`missing state` · `blocked by data` · `blocked by product decision` · `preview only` ·
`protected logic boundary`.

---

## 0. Executive summary

The single defining pattern across all four areas: **the app's craft ceiling lives in
its cold-launch cinematic and its honest engine/copy models — and that craft does not
reach the surfaces users open every day.**

- The cold-launch **OpeningSequence → WelcomeHero** is the best-realized surface in the
  app (reduced-motion aware, count-up, staggered reveals) — but its motion vocabulary
  **dies at the Home boundary** (`app/_layout.tsx` `AppShell` handoff). The live
  `HomeScreenV2` is a deliberately minimal spec layout: a **static** arc hardcoded to
  `af.red`, no count-up, **no adaptive presentation modes**, hardcoded "Updated just now".
- The **live Weekly Report** (`ReadinessInsightsV2`) is a thin 4-block chart summary; the
  rich editorial content (Performance Age, wins/missed, next-week focus, share) exists
  **only in the dead flag-off legacy path**. The underlying data models
  (`utils/weeklyReport.ts`, `utils/performanceAge.ts`) are honest and Score-Protection-safe.
- **`afMotion` motion tokens exist but are consumed by nothing.** Press states are
  opacity-only (no `AFMotionPressable`, no scale/haptic); reduced-motion is honored in
  only 5 files via two mechanisms with no shared hook; ~60 inline `expo-haptics` call
  sites with no façade or user setting; gauges are static SVG.
- **Voice Coach has 4 real profiles but no coaching *personality*:** `command.action` /
  `explanation` are byte-identical regardless of coach. There is **no
  `formatCommandForCoach`** adapter. The **trust-language strings** the brief names
  ("Code calculates. AI explains.", …) **do not exist as shipped copy** — only as code
  comments / governance doctrine.

**Net:** the elevation is achievable almost entirely in the **presentation layer**,
reusing existing primitives and honest models, behind **four new default-OFF flags**.
The main hard constraints are a small set of **blocked-by-data** items (Weekly trends,
top-command, image share) that must render as intentional "calibrating/unavailable"
states rather than fabricated intelligence.

---

## 1. Cinematic Home Experience

Live surface = `components/home/HomeScreenV2.tsx` (route `app/(tabs)/index.tsx`,
`spec_home` **ON** in prod, `featureFlags/flags.ts`). The rich legacy Home
(`HomeScreenLegacy`) and its ~35 `components/home/*` zones are dormant behind the flag —
elevation targets **V2**, not resurrection of legacy.

| Sub-area | Classification | Evidence |
|---|---|---|
| Cold-launch cinematic + `opening→welcome→done` machine | **already strong** | `app/_layout.tsx` `AppShell` (replays only on cold launch, never on tab return); `OpeningSequence.tsx` reduced-motion aware, tap-to-skip; `WelcomeHero.tsx` Ken-Burns push-in. |
| Motion continuity into Home | **missing interaction** | The cinematic vocabulary is not carried past the `done` handoff — Home's first paint is static. **Biggest single opportunity.** |
| Home layout / section hierarchy | **needs refinement** | `HomeScreenV2.tsx` — header → arc → one `AFCommandCard` → 3 signal tiles. Clean but shallow; no cinematic weight. |
| HydroState / arc reveal | **needs refinement / missing interaction** | `AFReadinessArc` is **static SVG**, V2 passes no animated progress → **no count-up, no tween from previous score**. |
| Arc band-color | **needs refinement** | Arc hardcoded `af.red` (`AFReadinessArc.tsx`) — does **not** hue-shift by readiness band; V2 Home never reads `statusColor.ts`. |
| Calibration / confidence display | **missing state** | Confidence logic exists (`utils/__tests__/commandConfidenceDisplay.test.ts`) but is not surfaced on Home. |
| "Updated just now" freshness | **blocked by data** | Hardcoded i18n string `home.v2.freshness`, not derived from a real last-update timestamp. |
| Next-command hero | **already strong** | `AFCommandCard` — exactly one dominant CTA + "Why this command" disclosure; copy is a prop (never invented). |
| Adaptive presentation modes | **missing state** | **No presentation resolver / Home variant** for balanced/recovering/depleted/calibrating/offline/guardian/cruise/clutch/competition/social. Home renders identically per band. |
| Home copy tone | **needs refinement** | Plain product-UI strings vs. the cinematic's "PERFORMANCE IS NON-NEGOTIABLE" register. |
| Reduced-motion on Home | **missing state** (prerequisite) | Trivially satisfied today because V2 Home has **no motion** — any added motion must add a reduced-motion branch. |
| Home component tests | **missing state** | **Zero** render/interaction tests for `HomeScreenV2`/`AFReadinessArc`/`AFCommandCard`. Only pure-util coverage exists. |
| a11y label ↔ route drift | **needs refinement** | Arc a11y label says "insights" but tap routes to `/weekly-report`; header comment disagrees — reconcile. |

**E1 buildable now (presentation-only, non-protected):** arc fill + score count-up on
mount (from previous→current, reduced-motion branch); band-tint the arc/command accent
from the read-only status color (without editing `statusColor.ts`); a pure **presentation
resolver** (`band → copy emphasis / accent / signal ordering`) that alters *presentation
only* and never touches score or command eligibility; carry the cinematic Reveal-stagger
into first paint; add the first Home component test.
**Deferred/blocked:** real "freshness" timestamp (blocked-by-data); confidence/calibration
sub-state (needs the confidence value surfaced through the store).

---

## 2. Extraordinary Weekly Report

Live surface = `components/insights/ReadinessInsightsV2.tsx` (route `app/weekly-report.tsx`,
`spec_weekly_report` **ON** in prod). Rich content lives only in the flag-off
`WeeklyReportLegacy`. Data model = pure `utils/weeklyReport.ts` + `utils/performanceAge.ts`.

| Sub-area | Classification | Evidence |
|---|---|---|
| Data model (builder) | **already strong** | `utils/weeklyReport.ts` pure/deterministic; explicit `collecting`/`awaiting` codes; no fabrication by construction. |
| Live V2 structure | **needs refinement** | 4 blocks: avg-score hero → line chart → 3 drivers → 1 insight. Thin vs. an editorial review. |
| Prior-week comparison | **blocked by data** | V2 "delta" = first-vs-last within one 7-reading window, **not** true week-over-week; a real prior-week series isn't passed in. |
| Narrative/summary | **already strong** | Templated from real top-driver data (no LLM, no fabrication). |
| Charts | **already strong / missing interaction** | `AFChart` requires a plain-language `summary`; but the summary is **screen-reader only** — no visible on-screen caption in V2. |
| Performance Age model | **already strong** | `utils/performanceAge.ts` — range-clamped, non-medical `PERFORMANCE_AGE_DISCLAIMER`, calibrating→established lifecycle, evidence-linked. |
| Performance Age on live surface | **blocked by product decision** | Present only in the dead legacy card; **absent from V2**; not labeled "Beta"; disclaimer constant defined but never rendered. |
| Data-honesty states (V2) | **missing state** | V2 has **one** state (empty `<2 days`); legacy has five distinct statuses. No calibrating/estimated/stale/unavailable in V2. |
| Wins / missed / next-week-focus | **blocked by product decision** | Exist as honest models in `weeklyReport.ts`; **absent from V2** — need re-composition. |
| "Top command this week" | **blocked by data** | `awaiting` — command-usage instrumentation does not exist (`commandUsage` never populated). |
| Share card | **missing interaction / preview only** | V2 has **no** share; legacy share is **text-only** (image export deferred); exclusion of private/health data is by *omission*, not a guard. |
| Reduced-motion / a11y | **already strong** | Static SVG (no motion to gate); chart summary + composed labels present. |
| V2 tests | **needs refinement** | Builder is well-tested but feeds the dead path; **no test** references `ReadinessInsightsV2`. |

**E2 buildable now:** re-compose the honest legacy sections (wins/missed/next-week-focus)
as editorial blocks in V2 over existing model data; add a **visible chart caption**;
add the richer data-honesty state vocabulary V2 is missing; render the
`PERFORMANCE_AGE_DISCLAIMER` wherever the number appears; typographic/hierarchy pass;
V2 component tests.
**Blocked-by-data (must render as intentional "calibrating/unavailable", never faked):**
Performance-Age & recovery week-over-week **trends** (need persisted daily snapshots),
**top command** (needs usage instrumentation), a **true prior-week delta**, and
**share-as-image** (needs `react-native-view-shot` wiring). These are the honest ceiling
on how "editorial" the trend narrative can be right now.

---

## 3. Premium Micro-Interactions & Motion

Foundation exists as tokens but is unadopted; two animation engines coexist.

| Sub-area | Classification | Evidence |
|---|---|---|
| `afMotion` tokens | **preview only** | `theme/afTokens.ts` defines durations/easing but **nothing consumes them** (module doc says so). No `cinematic` tier. |
| Reanimated vs legacy `Animated` | **needs refinement** | ~31 Reanimated files + a parallel set on legacy `Animated`; mixed easing/perf. |
| Reusable press/motion primitive | **missing interaction** | Press states are opacity/bg swaps only (`AFButton`/`AFCard`/`AFListRow`); **no `AFMotionPressable`**, no scale/spring, no press-haptic. |
| Animated gauge | **missing interaction** | `AFReadinessArc`/`AFProgressRing` are **static SVG** (0 animation) — never tween to value. |
| Skeleton/shimmer | **missing state** | Only `JournalChart` references skeleton; elsewhere loading = bare `ActivityIndicator`. |
| Empty/error/expand primitives | **already strong** | `AFEmptyState`, `AFErrorState`, `AFDisclosureSheet` exist. |
| Haptics | **needs refinement** | ~60 inline `expo-haptics` call sites; only wrapper is Phantom-Band pattern playback; **no UI façade, no user setting, no reduced-haptics gate**. |
| Reduced-motion | **needs refinement** | Honored in only 5 files via 2 mechanisms; **no shared hook**; `StatusPulseOrb`/`HeatPulse`/`AnimatedScore` ignore it — the `afTokens` "every motion must have a static alternative" contract is unenforced. |
| Pull-to-refresh | **needs refinement** | Default `RefreshControl` (tint only) on ~2 screens; no branded indicator. |
| Chart textual summaries | **already strong** | `AFChart` requires + exposes a plain-language summary. |
| Dynamic type | **missing state** | `allowFontScaling`/`maxFontSizeMultiplier` essentially unused → large-type layouts unbounded. |
| A11y settings screen | **missing state** | No in-app reduce-motion / reduce-haptics / larger-type control. |
| Audio lifecycle | **already strong** | Cleanup present across voice modules; **caveat:** `commandVoiceBus` has no explicit nav-stop hook (spot-check needed). |
| Motion/haptic/reduced-motion tests | **missing state** | Only token *values* are asserted; no behavioral tests. |

**E3 net-new primitives:** `AFMotionPressable`, `useReducedMotion` shared hook, central
`haptics` façade (+ user setting), skeleton/shimmer, branded `RefreshControl`, a
`cinematic` motion tier, a motion/reduced-motion test harness, an accessibility settings
screen.
**E3 extensions:** animate `AFReadinessArc`/`AFProgressRing` to value; tokenize the
hardcoded 900/1600ms literals in `AnimatedScore`/`RitualRail`/`HeatPulse`/`StatusPulseOrb`
onto `afMotion` and gate them by the shared reduced-motion hook.

---

## 4. Stronger AI Personality & Voice Coach

Two voice stacks coexist (shipped `commandVoice`/bus + dormant §64 conversational).
Evidence Engine and command copy are honest and largely protected; coaching *personality*
is the gap.

| Sub-area | Classification | Evidence |
|---|---|---|
| Coach profiles (rock/bb/surge/sage) | **already strong** | `services/voiceCatalog.ts` — id + ElevenLabs voiceId + archetype + description. |
| Playback discipline | **already strong / needs refinement** | `elevenLabsTts` disposes prior player (one clip per module); **but** bus and check-in keep *separate* active states → utterances can overlap. |
| VoiceCheckInOverlay | **already strong** | `energy→stress→goal→[intent]→closing`; stops speech on unmount/dismiss; never dispatches score. |
| PerformanceStatement | **already strong / preview only** | Once-per-day voice-only line; archetype-driven; data-driven personalized path **intentionally inert** (refuses to fabricate). |
| Command copy generation | **protected logic boundary** | `generateCommand`/`buildBaseCommand` select the branch + numbers (protected); the i18n `coach.*` string it names is presentation. |
| **Per-coach phrasing adapter** | **missing interaction** | **No `formatCommandForCoach`.** `command.action`/`explanation` are identical across coaches — coach identity only reaches TTS voiceId, PerfStatement pool, and the "Coach X" label. |
| AI copy structure | **needs refinement** | Intended `STATE+ACTION+TIMING+OUTCOME` (`types/voicePersona.ts`) but display surfaces expose a 2-part `action`+`explanation` (+ separate impact/recheck), not one composed hierarchy. |
| Trust-language strings | **missing / blocked by product decision** | The named strings ("Code calculates. AI explains.", …) **do not exist as shipped copy** — only code comments + governance. Clean copy elevation. |
| Evidence grounding | **already strong** | `utils/scoring/commandEvidence.ts` fail-closed parity selector; real value + freshness + provenance; no fabrication. |
| Voice tests | **already strong** | Best-covered of the four areas; gap: no per-coach copy-differentiation test (none exists yet). |

**The exact protected ↔ presentation seam (command phrasing):**
> **Protected (never edit for phrasing):** `utils/scoringEngine.ts`; branch selection &
> thresholds in `utils/scoring/copy.ts`; `urgencyLevel`/`estimatedImpact`/
> `calculateRiskTimer`; `utils/scoring/commandConfidence.ts`; the Evidence Engine
> `utils/scoring/commandEvidence.ts`; the §64 language guard `utils/intelligence/*`;
> `theme/statusColor.ts`; entitlement/flags.
> **Presentation (safe to elevate):** the `coach.*` / `evidence.item.*` /
> `performanceStatements.*` / `voiceCheckIn.*` string values in `locales/*.json`; overlay
> ordering in `composeExplanation`; tone banks in `data/voiceTemplates.ts` +
> `services/voice/commandVoice.ts`; coach `description`/`label` in `voiceCatalog.ts`.
> `generateCommand` decides the branch + numbers (protected); the string it names and any
> tone/coach transform applied before TTS are presentation.

**E4 buildable now (phrasing/delivery only — never changes score/evidence/eligibility):**
a `formatCommandForCoach(text, archetype)` adapter applied **after** `generateCommand`,
run through the existing §64 `isCompliantCoachLine` guard + `voiceTemplateEngine`
length/banned-phrase clamps (string-in/string-out); coach-differentiated line banks keyed
by archetype off the protected triggers; **ship the trust-language strings**; expose the
`STATE+ACTION+TIMING+OUTCOME` slots as a labeled 4-slot card render; unify playback
ownership into one "stop-previous" registry.

---

## 5. Shared foundation & constraints

### Protected boundaries — do NOT modify (consume read-only)

| File / area | Governs | Must not change |
|---|---|---|
| `utils/scoringEngine.ts` (+ `utils/scoring/*`) | 0–100 score + **4-band** PerformanceState (PEAK/BALANCED/RECOVERING/DEPLETED) | scoring math, band cutoffs, command authority |
| `theme/statusColor.ts` | separate **5-band** Score-Status ladder + status tint; **owns DEPLETED red `#FF2800`** | thresholds/hex/glow; an "elite" red must not collide with `#FF2800` |
| Evidence Engine — `utils/scoring/commandEvidence.ts`, `utils/intelligence/knowledgeGraph/*` (gate `evidence_engine_enabled`) | "Why this command" explainability; §38 graph | read-only projection; never awards/mutates/fabricates score |
| Entitlement/purchase — `featureFlags/subscriptionGate.ts`, `store/useCartStore.tsx`, `useSubscription`, `AFPrice`/`data/pricing.ts` | access + money path | gating & pricing logic; `AFPrice` stays presentation-only |
| `config/hydroStateModel.ts` | single source of truth for every threshold/constant (`hydrostate-v0`) | consume, never redefine; model-version change needs Founder+Eng approval |
| Persistence/backend — `lib/db/.../scoreSnapshotRepo.ts`, `JournalSnapshot`, api-server parity | snapshot schema, journal history, rehydration | schema + model-version stamp; parity with api-server mirror |

### Proposed feature flags — all **default OFF** (build behind flag, ship dark, light in DEMO)
Add each to the `FeatureFlags` interface (`types/index.ts`) + `DEFAULT_FLAGS` (`false`) +
`DEMO_ALL_ON_FLAGS` (`true`), read via `useFeatureFlags()` / `FeatureGate`:
`ELITE_HOME_EXPERIENCE_ENABLED` · `WEEKLY_REPORT_V2_ENABLED` · `AFORCE_MOTION_V2_ENABLED`
· `VOICE_COACH_V2_ENABLED`. None exist today. No dead code paths — each flag must gate a
reachable, tested surface. (Naming: repo uses both `spec_*` and `*_enabled`; recommend
aligning to lowercase `*_enabled` at implementation time to match the existing type — to
be confirmed in review.)

### Reuse-first primitive map
Reuse: `AFReadinessArc`, `AFProgressRing`, `AFCommandCard`, `AFMetric`, `AFChart`,
`AFTimeline`, `AFEditorialHero` (weekly), `AFCard`, `AFEmptyState`, `AFErrorState`,
`AFDisclosureSheet`, `AFSegmentedControl`.
Net-new (motion-driven): `AFMotionPressable`, `AFAnimatedGauge`/animate the existing arc
& ring, `AFVerifiedTransition`, `AFVoiceWaveform`(exists as `VoiceWaveform`, consolidate),
plus non-visual `useReducedMotion` + `haptics` façade.

### Data honesty (applies to every section)
Every surface must visibly distinguish **live / verified / estimated / user-entered /
calibrating / unavailable / stale / preview**. Where data is missing (the blocked-by-data
items in §2), render an **intentional state** — never fabricate trends, deltas, evidence,
coach explanations, or comparisons. This is the hard line the elevation cannot cross.

### Tests
Single root `vitest.config.ts` (alias `@/` → `artifacts/aforce-os/`); run `pnpm exec
vitest run`. Co-located `__tests__/`. Current coverage: Voice best; Home/Weekly at util
layer only; Motion behavioral coverage ~none. Every phase must add the missing
component/behavior tests the brief enumerates (reveal-only-when-eligible, reduced-motion
bypass, stale-score-does-not-animate, no-presentation-changes-HydroState, no-fabricated-
data, coach-changes-phrasing-only, one-preview-at-a-time, etc.).

---

## 6. Readiness by phase

| Phase | Buildable now (presentation-only) | Gated / blocked | Protected touch? |
|---|---|---|---|
| **E1 Cinematic Home** | arc count-up + reveal, band-tint accent, presentation resolver, cinematic-stagger first paint, first Home test | real freshness timestamp, confidence sub-state (data) | none (reads engine output only) |
| **E2 Weekly Report** | editorial section re-composition, visible chart caption, richer honesty states, PA disclaimer, V2 tests | PA/recovery WoW trends, top-command, true prior-week delta, image share (all blocked-by-data) | none (reads builder/PA models) |
| **E3 Motion System** | `AFMotionPressable`, `useReducedMotion`, `haptics` façade + setting, animate gauge, skeleton, branded refresh, `cinematic` tier, a11y settings, test harness | — | none (tokens/primitives only) |
| **E4 Voice Coach V2** | `formatCommandForCoach` (guarded), coach line banks, trust strings, 4-slot copy render, unified playback | — | none — phrasing/delivery only; branch/number/evidence stay in protected modules |

**No protected file needs editing for any phase.** If implementation ever appears to
require touching a protected file, **stop and flag it** before editing (per the brief and
CLAUDE.md).

---

## 7. Status

**Phase 0 (audit) — complete. No implementation started.** E1–E4 remain unbuilt and each
is gated behind its own default-OFF flag and its own PR + completion report. The
blocked-by-data items in §2 are the only hard ceiling; everything else is presentation-
layer work over existing primitives and honest models.

**Next step (awaiting approval):** confirm scope/flag-naming and the ordering (default
E1 → E2 → E3 → E4, one controlled PR each), then begin **E1 only**.
