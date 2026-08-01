# AForce OS — Screen Acceptance Matrix (Phase 0)

**Status:** Draft for founder review · Read-only audit · **Owner:** Julius + Brandon
**Verified against:** `52986ece` (2026-08-01). Source: Phase 0A route audit.

> Per-route production visibility, gating, error handling, and acceptance-state coverage. Acceptance
> states audited: **Loading · Empty · Populated · Partial · Stale · Offline · Denied-permission ·
> Recoverable-error · Unrecoverable-error**. "EB" = error boundary. There is exactly **one**
> ErrorBoundary, at the app root (`app/_layout.tsx:371`); **no route has its own boundary**, so any
> screen crash blanks the whole app. Deterministic-fixture coverage lives in `demo/galleryFixtures.ts`
> (dev/demo only). Full per-state acceptance criteria are a Phase-1 build deliverable; this matrix
> records current coverage and gaps.

---

## 1. Bottom tabs (5 visible) + hidden tab routes

| Route | Tab / model | Flag | Prod-visible | Own EB | Notable gaps |
|---|---|---|---|---|---|
| `(tabs)/index` Home | Home = decide | Auth | ✅ | ✗ (root) | calm "no-command" state absent (0C) |
| `(tabs)/journal` Hydration | Hydration = record | Auth | ✅ | ✗ | shallow model; no absorption/pressure/source-freshness on tab (0D) |
| `(tabs)/protocol` Protocol | Protocol = execute | Auth | ✅ | ✗ | NOW/NEXT/LATER completion-condition coverage = Phase-1 verify |
| `(tabs)/competition` Circle | Circle = belong | `spec_community` on | ✅ | ✗ | naming PA-01; public leaderboard SS-07 |
| `(tabs)/profile` Profile | Profile = control | Auth | ✅ | ✗ (root) | Developer tab SS-01; React-Compiler crash mitigated by babel workaround SS-18 |
| `(tabs)/scan` | href:null | Auth | ✅ (hidden) | ✗ | — |
| `(tabs)/social` | href:null → SocialModeV2 | Auth | ✅ (hidden) | ✗ | duplicate of `social-v2` SS-20 |
| `(tabs)/social-legacy` | dev tab / deep-link | Auth + devMode | deep-link ✅ | ✗ | legacy reachable in prod SS-20 |
| `(tabs)/sleep` | href:null | Auth | ✅ (hidden) | ✗ | — |

## 2. Root stack routes

| Route | Flag / gate | Prod-visible | Own EB | Status / gap |
|---|---|---|---|---|
| `index` (cold-launch router) | Auth + onboarding | redirector | ✗ | SplashGate → onboarding under DEMO_MODE |
| `onboarding` | none | ✅ | ✗ | first-command flow — Phase-1 acceptance |
| `weekly-report` | route ungated; `spec_weekly_report` on | ✅ | ✗ | insufficient-data state = key acceptance (0F) |
| `leaderboard` → V2 | `spec_leaderboard` | ✅ | ✗ (root) | crash-workaround SS-18; named-user exposure SS-07 |
| `achievements` | `spec_achievements` | ✅ | ✗ | — |
| `cart` / `store` / `subscription` / `subscription/manage` | `spec_*` | ✅ | ✗ | server-authoritative pricing (0K) |
| `scan` (root) | `spec_scan` | ✅ | ✗ | consumption ladder SS-23 |
| `urine-check` | `spec_urine` | ✅ | ✗ | observation-only verdicts (CR-1) |
| `sweat` | `spec_sweat` | ✅ | ✗ | correct formula; **no unit tests**; L/h-only display |
| `share` | `spec_share` | ✅ | ✗ | identity-not-data (good); default-share posture SS-06 |
| `notifications` | `spec_notifScreen` | ✅ | ✗ | no Daily-Standard cap/rotation (0C) |
| `circles`, `circles/[id]`, `circles/manage`, `circles/shared` | none found | ✅ | ✗ | **no gate found — needs investigation**; moderation/age gap SS-08 |
| `science` | `spec_science` reskin, no dev gate | ✅ | ✗ | ungated (product surface) |
| `sensors` | `spec_sensors` reskin, no dev gate | ✅ | ✗ | ungated |
| `social-v2` | none | ✅ | ✗ | duplicate mount SS-20 |
| `modules` | **none** ("INTERNAL EVALUATION") | ✅ | ✗ | SS-19 |
| `territory` | none found | ✅ | ✗ | needs-investigation gate |
| `recovery-coach` | `spec_recoveryCoach` off → redirect | ✗ | ✗ | Built-Hidden |
| `cruise` (root) | `cruise_mode_enabled` on | ✅ | ✗ | Personal Cruise live, disclaimered (PA-08) |
| `guardian`, `heat`, `heat/guardian` | `guardian_intelligence_enabled` off | locked | ✗ | DR-006 copy gap SS-09 |
| `clutch` | `clutch_access_enabled` off | locked | ✗ | mock; SS-09 |
| `phantom`, `ring`, `ring/session` | flag off → redirect | ✗ | ✗ | Built-Hidden |
| `(hidden)/cruise/*` | `spec_cruise` off → redirect | ✗ | ✗ | static skeleton |
| `(hidden)/gallery`, `(hidden)/motion-demo`, `ui-gallery` | `__DEV__`/`DEMO_MODE` → redirect | ✗ | ✗ | correctly gated |
| `legal/*` | none (public) | ✅ | ✗ | shipped |
| `+not-found` | — | ✅ | ✗ | Home link, fine |

## 3. Systemic acceptance-state gaps (all routes)

| Gap | Evidence | Severity |
|---|---|---|
| No per-route error boundaries → any crash is app-wide | `_layout.tsx:371` only | S3 (SS-18) |
| **Zero component/screen render tests** — Empty/Partial/Stale/Denied states never asserted against rendered UI | 0L (`find … *.test.tsx` → 0) | S2 (coverage) |
| Deterministic fixtures exist only in dev/demo (`galleryFixtures.ts`), not wired to production acceptance tests | 0A/0L | S2 |
| Stale-data timestamps + source/freshness surfaced on Home, **not** on Hydration/Protocol tabs | 0D | S3 |
| Denied-permission state for camera exists (scan); for providers it is implicit "Not connected", not a first-class permission token | 0B/0F | S3 |

## 4. Acceptance criteria (to be authored in Phase 1)

For each of the five bottom-tab screens, Phase 1 should define and test the deterministic states the
prompt enumerates (first-open, morning, midday, pre/post-training, Peak/Balanced/Recovering/Depleted,
offline, limited/stale/partial data, permissions-missing, sync-in-progress, no-command). This matrix
is the **inventory**; the acceptance criteria + deterministic screenshots per state are a build
deliverable, not part of Phase 0.

## 5. Night Out Protocol deterministic states (2026-08-01)
`AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` §24 enumerates the required Night-Out acceptance states
(first-use, alcohol-free, off, preparing, active-no-command, active-with-Water-First-command,
accepted/adjusted/deferred command, partial/verified water completion, scanned/selected/intended-not-
consumed, neutral confirmed alcohol log, corrected/deleted entry, before-sleep + next-morning handoff,
limited/stale/offline/pending-sync/conflict, denied notifications/health-permissions, Force-Mode off,
lock-screen-previews off, ineligible-alcohol controls, emergency-boundary, recoverable/unrecoverable
error). Night Out must render **inside the Protocol tab** (no 6th tab). Fixtures must never appear as
fabricated provider measurements. Authoring these rows + screenshots is a build deliverable.

**NO-c (2026-08-01):** deterministic **view-model fixtures** now exist for 8 Water-First command states
(`services/nightOut/commandFixtures.ts`): pre-session-command, pre-session-no-command, active-timer,
timer-expired, processing, limited-confidence, stale-offline, invalid-timer-recovery — each test-locked
to its mode. Route/flag states (unauthorized-redirect, flag-off, internal-preview) are covered by the
routing tests. **Real-device / preview screenshots for these states are still pending** (the screen is
gated behind the DEMO/internal context) — do not classify the Night Out visual experience as fully
Validated until captured.
