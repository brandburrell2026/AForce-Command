# AForce OS — Visual System Audit (extend, not rebuild)

**Status:** Repo-side audit complete · per-screen **visual-fidelity comparison PENDING the 21 reference images** (`design/aforce-os-reference/` not yet populated).
**Prepared:** 2026-08-01 · **Decision recorded (founder):** *extend* the shipped `af.*` design system toward the 21 reference screens; **do not** rebuild, fork, or rebrand. Reuse existing tokens / components / navigation / state colors; add only genuinely-missing primitives and screens; preserve backward compatibility; do not touch protected scoring / HydroState / Evidence Engine / safety / entitlement logic.

> This is the audit gate. **No implementation begins until this is reviewed** (per the prompt and CLAUDE.md's plan-before-large-change rule). The app already ships a dark, command-oriented `af.*` interface — this is a **gap-close on a shipped system**, not a build.

---

## 1. Reconciliation: what of the pasted prompt we follow vs. reject

**Follow (excellent, adopted):** audit-first gate; protect scoring/entitlement/safety/data-integrity; data-honesty state taxonomy (Live/Verified/User-entered/Estimated/Preview/Unavailable/Calibrating); loading/empty/error states; accessibility bar; motion discipline; phased delivery + per-phase completion reports; a formal mode presentation resolver (presentation-only).

**Reject / adapt (conflicts with governed reality):**
1. **The proposed token palette** — `red:#FF2A1F`, `teal:#20A9B5`, `background:#030405`, "Balanced→Teal". These **violate the FROZEN brand v2.2.0** (`theme/afTokens.ts`): Signal Red **#C1281B** (spec's off-brand red is documented as "an error"), Cinematic Black **#0D0D0D**, state palette PEAK green `#1FA35A` / BALANCED cyan `#00E5C8` / RECOVERING amber `#FFA01E`. `#FF2A1F` also collides with the **off-limits** DEPLETED red (`#FF2800`) owned by `theme/statusColor.ts`. → **We keep the frozen brand.** Reference-screen colors are treated as *mood direction*, mapped onto the existing `af.*` tokens. Any actual brand-palette change requires Julius + Brandon approval + beta evidence (CLAUDE.md) — out of scope here.
2. **A new `src/design-system/` with `AForce*` components** — would **fork** the shipped `theme/` + `components/ui/AF*` set (see §5). → **We extend `components/ui/` (`AF*`)**; new primitives only for real gaps.
3. **"Rebuild" the screens** — forbidden by CLAUDE.md build rules ("no new nav or rebuilds") and unnecessary: most screens are shipped. → **We refine existing `…ScreenV2` surfaces** and wire dormant ones.

---

## 2. Stack (all preferred deps already present — zero new dependencies)

Expo `~54.0.35` · React Native `0.81.5` · expo-router `~6.0.24` · Reanimated `~4.1.1` · Gesture Handler `~2.28.0` · react-native-svg `15.12.1` · expo-linear-gradient · expo-haptics · expo-blur · TypeScript `~5.9.2`. Navigation = expo-router file routes in `app/`. No `@react-navigation/native` direct dep, no `victory-native` (charts via `AFChart`/SVG).

---

## 3. Per-screen classification (21 reference screens)

Class legend: **WIRED** (live in prod, real data) · **INCOMPLETE** (live but partial vs reference) · **MOCK** (surface live, data is mock) · **PREVIEW** (built, flag-dark in prod, on in demo) · **BLOCKED** (gated off, needs product/entitlement decision) · **MISSING** (no surface). The **VISUAL** column (does it match the ref) is **pending the images**.

| # | Screen | Route | Main component | Flag → prod | Class | Visual vs ref |
|---|--------|-------|----------------|-------------|-------|---------------|
| 1 | Main Home (depleted) | `app/(tabs)/index.tsx` | `home/HomeScreenV2` | `spec_home` ✅ | **WIRED** (depleted = a score band, not a separate screen) | pending |
| 2 | Hydration Ledger | `app/(tabs)/journal.tsx` | `hydration/HydrationScreenV2` | `spec_hydration` ✅ | **WIRED** | pending |
| 3 | Daily Protocol | `app/(tabs)/protocol.tsx` | `protocol/ProtocolScreenV2` | `spec_protocol` ✅ | **WIRED** | pending |
| 4 | Command full-screen | `app/recovery-coach.tsx` | `recoveryCoach/RecoveryCoachScreen` | `spec_recoveryCoach` ❌ (demo on; redirects `/` in prod) | **PREVIEW** — polish + wire a Home entry | pending |
| 5 | Weekly Report | `app/weekly-report.tsx` | self-contained | `spec_weekly_report` ✅ | **WIRED** (projection; no fabricated data) | pending |
| 6 | Circle (Recovery Circle) | `app/circles.tsx` | `screens/CirclesScreen` | `spec_recoveryCircle` ✅ | **WIRED** — *distinct from the "Community" tab (#8)* | pending |
| 7 | Profile | `app/(tabs)/profile.tsx` | `profile/ProfileScreenV2` | `spec_profile` ✅ | **WIRED** (note: web-only crash in demo; native fine) | pending |
| 8 | Competition / Game-Day | `app/(tabs)/competition.tsx` | `community/CompetitionScreenV2` | `spec_community` ✅ | **MOCK** — surface live, roster/leaderboard mock; no separate Game-Day screen | pending |
| 9 | Cruise Mode | `app/cruise.tsx` | `screens/CruiseModeScreen` | `spec_cruise` ❌ / `cruise_*` ❌ | **MOCK / PREVIEW** | pending |
| 10 | Guardian Mode | `app/guardian.tsx` | inline + `GuardianHeatScreen` | `guardian_intelligence_enabled` ❌ | **BLOCKED / MOCK** | pending |
| 11 | HydroScan | `app/scan.tsx` | `scan/HydrationScanScreenV2` | `spec_scan` ✅ (`hydro_scan_2_enabled` ❌) | **WIRED** (base live; HydroScan-2.0 layer = PREVIEW) | pending |
| 12 | Skin Performance (preview) | — | — | — | **MISSING** — true greenfield (nothing exists) | pending |
| 13 | Activity Context | — | engines: `location/locationIntelligence`, `modes/smartModes`; banners `home/SmartModesBanner` | `location_intelligence_enabled` ❌ | **MISSING as a screen** (headless engine exists) | pending |
| 14 | Clutch Mode | `app/clutch.tsx` | inline | `clutch_access_enabled` ❌ | **BLOCKED / MOCK** | pending |
| 15 | Morning Calibration | overlay | `voiceCheckIn/VoiceCheckInOverlay` | `voice_checkin_enabled` ❌ | **PREVIEW** — *note: it is a **voice** ritual; there is no reaction-time test in-repo* | pending |
| 16 | Why This Command | in-surface | `home/CommandEvidence`, `WhyThisScore`, `WhyThisForYouCard` | `evidence_engine_enabled` ❌ | **PREVIEW** — engine 100%, surface dark | pending |
| 17 | Performance Memory | Profile card | `utils/performanceMemory*`, `intelligence/executionMemory` | `performance_memory_execution_enabled` ❌ | **PREVIEW** | pending |
| 18 | Activate AForce OS | activation journey + `app/subscription.tsx` | `home/ActivationJourneyZone`, `subscription/SubscriptionScreenV2` | `spec_activation` ✅ / `spec_subscription` ✅ | **WIRED** — no single standalone "Activate" screen; it's the journey + subscription + entitlement bridge | pending |
| 19 | Social Mode | `app/social-v2.tsx` | `screens/SocialModeV2Screen` | `spec_social` ✅ | **WIRED** (safety-sensitive — see §7) | pending |
| 20 | Voice Coach | in-surface (Home) | `VoiceButton`/`VoiceOverlay`; `voiceService`/`voicePersonaService` | `spec_coachV2` ✅ (`voice_status_module_visible` ❌) | **WIRED** — engine live; status footer hidden | pending |
| 21 | Permissions & Control (3/3) | `app/onboarding.tsx` | `onboarding/OnboardingScreenV2` + `components/settings` | `spec_onboarding` ✅ | **INCOMPLETE** — no dedicated standalone permissions screen matching the ref | pending |

**Counts:** WIRED 9 · MOCK/BLOCKED 4 (8,9,10,14) · PREVIEW 5 (4,15,16,17 + HydroScan-2.0) · INCOMPLETE 1 (21) · MISSING 2 (12,15… — i.e. 12 Skin, 13 Activity-as-screen).

---

## 4. Navigation — tab reconciliation

`app/(tabs)/_layout.tsx` (renders `ClassicTabLayout`; `native_tabs_enabled` ❌ = iOS-26 crash workaround; group Clerk-gated):
1. `index` → **Home** · 2. `journal` → **Hydration** *(route kept `journal` for deep-links + protected Timeline contract; only label/icon changed)* · 3. `protocol` → **Protocol** · 4. `competition` → **Community** · 5. `profile` → **Profile**.

> **Naming note for the reference "Circle" tab:** the 5th tab is internally **`competition`**, user-label **"Community"** — that IS the prompt's "Circle" tab. A *separate* Recovery-Circle surface exists at `app/circles.tsx` (#6). Keep the route name `competition` (deep-link/analytics compatibility); only the label is "Community". Do not rename routes.

---

## 5. Existing `components/ui/` primitives (extend these — don't fork)

`AFScreen` (scaffold) · `AFCard` · `AFButton` (`AFPrimaryButton`/`AFSecondaryButton`/`AFTextButton`) · `AFMetric` · `AFReadinessArc` (score gauge) · `AFProgressRing` · `AFStatusBadge` · `AFSectionLabel` (eyebrow) · `AFListRow` · `AFTopBar` · `AFCommandCard` · `AFTimeline` · `AFChart` · `AFDisclosureSheet` ("data behind this") · `AFEmptyState` · `AFErrorState` · `AFEditorialHero` · `AFPrice` · `AFProductCard` · `AFSegmentedControl` · `afPrimitives.logic.ts` (shared pure logic).

**Maps the prompt's requested components almost 1:1** (AForceScreen→AFScreen, HydroStateGauge→AFReadinessArc, CommandCard→AFCommandCard, ProtocolStep→AFTimeline, EvidenceRow→AFListRow/AFDisclosureSheet, etc.). Genuine primitive gaps to *add* under `components/ui/` if the refs require them: `AFToggle`, `AFIconTile`, `AFOutlineButton` (currently `AFSecondaryButton`), a `SafetyNotice`/`PreviewNotice` pair, and a `LoadingSkeleton` — confirmed against images before adding.

## 6. Token modules (`theme/`) — bind to these, never to off-limits files

`afTokens.ts` (`af`/`afType`/`afLayout`/`afMotion`, brand-frozen) · `colors.ts` (`Colors`, `getStateColors`) · **`statusColor.ts` — OFF-LIMITS** (5-band score→color) · `typography.ts` (Archivo Black / IBM Plex Mono / Inter) · `spacing.ts` (`Spacing`/`Radii`/`Shadows`) · `icons.ts` (Lucide tokens) · `recoveryCoachTokens.ts` (full-screen command surface, deeper `#050506`).

**OFF-LIMITS (do not edit):** `utils/scoringEngine.ts` (score formula + 4-band `resolveState` PEAK/BALANCED/RECOVERING/DEPLETED + command rules + Clutch/Guardian tiers) and `theme/statusColor.ts`. Both have wide dependents (Home, Social, Clutch, Guardian, command-confidence, recalibration, store). The `af.*`/`recoveryCoach` tokens deliberately *reference* these — so redesign work binds to **tokens**, never to the off-limits files.

---

## 7. Safety- & money-path sensitivities (do not regress)

- **Social Mode (#19):** never claim breath-alcohol measurement; never state safe-to-drive / a "safe driving time"; "Arrange a ride" = external/existing integration only; alcohol data private (never in Circle/Community/leaderboards). Existing `SocialSafetyCard`/`BACEstimateCard`/`ImpairmentRiskBadge` copy is safety-locked.
- **Guardian (#10):** alerts only under existing eligibility/confidence rules; no false urgency; non-medical disclaimer.
- **HydroScan (#11):** scan is advisory; only confirmed "I Drank This" writes the ledger; scan never mutates HydroState.
- **Activation (#18):** QR/code verifies server-side; never hardcode entitlement success; read pricing from the existing source, never embed literals.
- **Skin Performance (#12):** if built, internal flag only (`SKIN_PERFORMANCE_PREVIEW_ENABLED`), no camera permission when off, "Observation only. Never diagnoses." — and it's greenfield, so it's the lowest-priority, highest-caution item.

---

## 8. Proposed phasing (extend-scoped; each phase = its own PR, after images land)

- **P0 (now):** this audit + populate `design/aforce-os-reference/` + a deterministic **screen gallery** (`src/demo/AForceScreenGallery`) rendering the shipped `…ScreenV2` surfaces in fixed states for side-by-side diffing against the refs.
- **P1 — token/primitive gap-close:** only the specific `af.*` values / new `AF*` primitives the images prove are missing. No screen rewrites.
- **P2 — refine WIRED daily surfaces:** Home / Hydration / Protocol / Community / Social to match refs (spacing, hierarchy, states). Real data preserved.
- **P3 — wire PREVIEW surfaces' entries** (Command full-screen, Why-This-Command, Performance Memory, Morning Calibration) behind their existing flags; polish to ref. No new engines.
- **P4 — greenfield behind flags:** Activity Context screen (over the headless engine) and the Skin Performance shell (internal flag).
- **P5 — INCOMPLETE:** a dedicated Permissions & Control 3/3 surface (progressive permissions).

Companion docs to produce during implementation (per the prompt): `AFORCE_OS_DESIGN_SYSTEM.md`, `SCREEN_MAP.md`, `STATE_MATRIX.md`, `ACCESSIBILITY.md`, `VISUAL_QA.md`, `FEATURE_FLAGS.md`.

---

## 9. Blockers / needs before implementation

1. **The 21 reference images** → `design/aforce-os-reference/` (drives the per-screen VISUAL column + the P1 gap list). Nothing reference-faithful proceeds without them.
2. **Product/entitlement decisions** for the gated modes (Clutch/Guardian/Cruise) and greenfield Skin — these are BLOCKED on flags/product, not on UI.
3. **Confirm** this extend-scoped plan before P1 code.

*No source files were modified for this audit.*
