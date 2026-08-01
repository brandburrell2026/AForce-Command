# AForce OS — Elite Polish: Audit & Reconciled Roadmap

_Generated 2026-08-01 · the "9.4 → 10" polish program, reconciled against what is
already shipped and what is genuinely constrained._

This is the deliverable package for the "world-class / Apple-level" polish brief
(UX / design / motion / a11y / performance audits + AI-personality guide +
integration architecture + interaction checklist + roadmap). It is **additive and
architecture-preserving** by construction, and it is **honest**: several requested
items are already merged, a few are blocked by data that does not exist yet, and a
few collide with the brief's own non-negotiables. Those are called out, not hidden.

Parent gates: [`AFORCE_OS_EXPERIENCE`… audit](./AFORCE_OS_ELITE_EXPERIENCE_AUDIT.md),
[`AFORCE_OS_VISUAL_AUDIT.md`](./AFORCE_OS_VISUAL_AUDIT.md) (extend-not-rebuild), and the
frozen brand v2.2.0 + protected files (`utils/scoringEngine.ts`, `theme/statusColor.ts`,
Evidence Engine, entitlement, `config/hydroStateModel.ts`, persistence contracts).

---

## 0. Status at a glance (the 12 phases)

| # | Phase | Status | Where |
|---|---|---|---|
| 1 | Fix every issue (Profile / Leaderboard / boundaries) | **Done** | `/profile` + `/leaderboard` fixed (React-Compiler scope) — PR #438; 45-route audit — PR #432 |
| 2 | Elite Home | **Shipped, extendable** | E1 — PR #434 (arc reveal + count-up, band accent, presentation resolver). *Ring glow/breathing = next increment.* |
| 3 | Weekly Report story | **Shipped, partly blocked-by-data** | E2 — PR #435 (editorial sections + honest states + PA/Beta). *The "improved 18%" causal narrative needs data that doesn't exist yet.* |
| 4 | Motion system | **Foundation shipped, adoption pending** | E3 — PR #436 (`useReducedMotion`, `haptics`, `AFMotionPressable`, `AFSkeleton`, `cinematic` tier). *Broaden adoption next.* |
| 5 | AI personality | **Shipped, extendable** | E4 — PR #437 (coach eyebrow/tone + trust copy, §64-guarded). *Sage/Surge line banks + TTS cadence = next.* |
| 6 | Store personalization | **Largely already present** | `StoreScreenV2` already shows "Recommended for you · State: BALANCED / RECOMMENDED FOR RECOVERING". *Refinement, not net-new.* |
| 7 | Micro-interactions | **Partial (via E3)** | Primitives exist; per-surface adoption is incremental. |
| 8 | Accessibility (AAA) | **Partial** | Chart summaries + reduced-motion done; **a11y settings screen + dynamic-type clamps deferred** from E3. |
| 9 | Performance | **Improved, auditable** | React-Compiler scope fixed a crash + narrows compilation. Deeper audit below. |
| 10 | Health-platform integrations | **Large + partly OFF-LIMITS** | WHOOP OAuth exists; the rest needs data-model/API/secrets/backend work + founder approval. **Cannot be "executed directly" safely in one pass.** |
| 11 | Visual consistency | **Enforced by tokens; gaps auditable** | `af.*` / `afType` / `afLayout` already normalize this; legacy screens drift. |
| 12 | Final polish pass | **Ongoing** | Rolls up 2/4/7/11. |

---

## 1. UX audit

**Strong today:** one-score / one-command / one-CTA Home hierarchy; honest empty/
calibrating/awaiting states (Weekly, Hydration); the cinematic cold-launch; the
5-tab structure. **Opportunities (additive):**
- Home *arrival* differentiation: the cinematic dies at the Home boundary on warm
  entry — a restrained "first-open-of-day vs return" treatment (E1 laid the resolver).
- Command card as "coach speaking": E4 added eyebrow/tone; a subtle
  speaker-affordance + confidence chip would deepen it (confidence logic already
  exists, un-surfaced).
- Weekly as narrative: E2 shipped the editorial stack; the *causal* headline is gated
  on data (see §Constraints).
- Store: already recommendation-led; tighten the "why" chips to the live band/heat.

## 2. Design audit
- **Tokens are the backbone** (`theme/afTokens.ts`): color/type/layout are centralized;
  new work must consume, never re-declare. DEPLETED red `#FF2800` is owned by
  `statusColor.ts` — never collide (E1 used Signal Red `#C1281B` for band accent).
- **Depth/glass/lighting**: the brand is edge/tone over heavy shadow (spec §3.5). "Glass"
  should be a *tasteful* elevated surface + hairline, not iOS blur everywhere (blur is
  a known perf cost on low-end). Recommend an `af` elevation ramp already present
  (`surface → surfaceRaised → surfacePressed`) + one optional focused blur on the
  Recovery Coach canvas only.
- **Consistency gaps**: legacy screens (`screens/*`) use raw hex + Inter literals vs the
  `af.*` system on the V2 screens. A normalization sweep (Phase 11) is real, mechanical,
  and low-risk behind the existing spec flags.

## 3. Motion audit
- **Foundation exists (E3)** but is **not yet adopted** beyond `AFButton`: the animated
  gauge, staggered entrances, skeletons, and the `cinematic` tier are available and
  reduced-motion-safe. Hardcoded 900/1600ms literals still live in `AnimatedScore` /
  `RitualRail` / `HeatPulse` / `StatusPulseOrb` and should be tokenized + reduced-motion
  gated. Ring "breathing"/glow (Phase 2) is a new, small, reduced-motion-gated add on
  `AFReadinessArc`.
- **Rules already encoded**: `motionLogic.ts` (`shouldAnimate`/`pressScale`) + the
  `useReducedMotion` contract. "Every animation has a static alternative" is testable.

## 4. Accessibility audit
- **Done**: chart plain-language summaries (`AFChart`), reduced-motion branches (E1/E3),
  composed a11y labels, 44pt targets in primitives, never-color-alone status.
- **Gaps (buildable)**: **dynamic-type clamps** (`maxFontSizeMultiplier`) are essentially
  unused → large-type layouts unbounded; **no in-app accessibility settings screen**
  (reduce-motion / reduce-haptics / larger-type) — deferred from E3; screen-reader label
  coverage is ~46% of files.

## 5. Performance audit
- **Win**: scoping the React Compiler to app source (PR #438) both fixed the
  Profile/Leaderboard crash and stopped compiling generated `lib/*` code.
- **Targets**: audit `StatusPulseOrb`/`HeatPulse` looping animations for reduced-motion +
  UI-thread residency; consolidate the two animation engines (Reanimated vs legacy
  `Animated`); confirm `commandVoiceBus` stops audio on nav; verify no default
  `ActivityIndicator` where `AFSkeleton` now exists. No evidence of network waterfalls in
  the demo path (mock-backed). "120fps feel" = UI-thread Reanimated + no JS-thread
  animation, which E3's primitives already follow.

## 6. AI personality guide
- **Shipped (E4)**: per-coach eyebrow + tone lead + trust copy, **§64-guarded**
  (observation-only) and **substance-preserving** (dose/timing never change).
- **Guide (for the line banks — all delivery-only, never score/eligibility):**
  - **Coach Rock (push)** — short, commanding. "Lock in." / "Water first — finish it."
  - **Coach Sage (recovery)** — calm, reflective. "Slow is sometimes faster." / "Ease in."
  - **Coach Surge (ignite)** — competitive, motivational. "Finish the window before training." / "Go now."
  - **Coach BB (precision)** — technical, executive. "Execute cleanly." / "You have time to improve readiness."
  - Every line runs through `isCompliantCoachLine` + the substance-preservation check;
    fail-safe to the neutral string. Extend to `commandVoice.ts` TTS banks (today
    intensity-keyed) as E4.1.

## 7. Integration architecture (Phase 10 — honest)
First-class wearables (Apple Health, Health Connect, WHOOP, Oura, Garmin, Samsung,
Polar, Suunto, Coros, Fitbit) is a **multi-PR, partly OFF-LIMITS program**, not a
"polish" pass:
- **Already exists**: WHOOP OAuth full pipeline (see `whoop-oauth-config`); a
  provider/health-connection abstraction (`services/healthConnection.ts`, build-only UI).
- **Requires (needs founder approval — OFF-LIMITS per CLAUDE.md):** OAuth **secrets** per
  provider, **backend** callback routes + token storage (encrypted columns), **entitlement**
  gating, and **data-model/API** additions for background/incremental sync + conflict
  resolution. This **directly conflicts** with the brief's "do NOT change data
  models/APIs." Recommended shape (for approval, not immediate execution): a typed
  `HealthProvider` interface (connect/status/sync/disconnect) + a normalization layer that
  merges signals into the **existing** readiness inputs **read-only**, always surfacing
  honest connection state and never fabricating. This is its own scoped project.

## 8. Elite interaction checklist (per surface)
Press (scale+haptic ✅ via E3) · loading (→ `AFSkeleton`) · empty (`AFEmptyState` ✅) ·
error→retry (`AFErrorState` ✅) · success (haptic + `AFVerifiedTransition` — to build) ·
expand/collapse (`AFDisclosureSheet` ✅) · tab active (dot/underline motion — to build) ·
pull-to-refresh (branded — deferred) · chart reveal (left-to-right + on-screen summary,
E2 added the summary) · achievement unlock (to build, reduced-motion-gated) · navigation
transition (respect native-stack; no JS-thread work). Nothing should read as default RN.

## 9. Implementation roadmap (recommended order)

**Already merged:** Phase 1 (fixes), E1 (Home), E2 (Weekly), E3 (Motion foundation),
E4 (Voice) — all flag-gated, no protected logic touched.

**Buildable now (safe, incremental, each its own flag-gated PR):**
- **P-A · Ring alive (Phase 2 finish):** reduced-motion-gated glow + slow "breathing" on
  `AFReadinessArc`, tokenized on the `cinematic` tier. Small, high-emotion.
- **P-B · Motion adoption (Phase 4/7):** tokenize the hardcoded durations + gate looping
  animations by `useReducedMotion`; adopt `AFSkeleton` in real loading states; add the
  tab active-indicator + `AFVerifiedTransition` (completion). 
- **P-C · Accessibility settings + dynamic-type (Phase 8):** the deferred a11y screen
  (reduce-motion / reduce-haptics / larger-type) + `maxFontSizeMultiplier` clamps on
  display/metric text.
- **P-D · Coach line banks (Phase 5 finish / E4.1):** archetype-keyed banks for
  `commandVoice.ts`, guarded identically.
- **P-E · Store "why" refinement (Phase 6):** tie the recommendation chips to the live
  band/heat (data already present).
- **P-F · Visual-consistency sweep (Phase 11):** normalize legacy `screens/*` onto `af.*`
  tokens behind the existing spec flags.

**Blocked / gated (not buildable as "polish"):**
- **Weekly causal narrative ("hydration +18% → faster recovery")** — needs **persisted
  daily snapshots** + a real prior-week series (blocked-by-data; E2 renders honest
  "Collecting…" instead). Unblock = a data/persistence project, not UI.
- **Top-command / protocol-adherence trends** — need usage instrumentation (currently
  "Awaiting data").
- **Phase 10 wearables** — the OAuth/secrets/backend/entitlement/data-model pieces are
  OFF-LIMITS + contradict the no-API-change rule → separate project + founder approval.

---

## Constraints & contradictions (surfaced, not silently resolved)
1. **"Do NOT change data models / APIs" vs Phases 3 & 10.** A story Weekly with real
   week-over-week trends and any real wearable sync both require new persistence/data
   flow. Honest options: (a) keep the additive-only rule and render honest
   calibrating/awaiting states (shipped), or (b) authorize a scoped data/persistence
   project. Can't have the rich narrative *and* the no-data rule *and* no fabrication.
2. **"Do NOT invent fake health data" vs the "+18%" example.** The example itself would
   be fabricated today. E2 deliberately shows the honest state instead.
3. **Off-limits (CLAUDE.md):** scoring/status-color math, secrets, domain/deploy config,
   backend/DB — Phase 10 and any "combine into one readiness model" change touch these
   and require founder sign-off.

**Recommendation:** proceed with **P-A → P-F** (all safe, additive, flag-gated,
architecture-preserving) in that order, one PR each, as with E1–E4. Escalate the
Weekly-data and wearables tracks as their own approved projects. Nothing here ships
broken, fabricated, or over a protected boundary.
