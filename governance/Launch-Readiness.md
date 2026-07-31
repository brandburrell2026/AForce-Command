# AForce OS — Launch Readiness Tracker

Maintained by **scrum-master**. Consolidates what blocks the September 2026 launch across
all workstreams. Verified against `main` @ `7d40b4d7` (2026-07-31).

**Refresh 2026-07-31:** ~40 PRs (#359–#403) landed since the prior verify (`d44fc159`,
2026-07-18). Three programs completed in that window: **(a)** the redesign go-live — the
Phase-3 redesigned screens are now default-ON (`spec_*` screen flags flipped `true`) with a
full i18n (11 locales) + accessibility pass; **(b)** the **PASS-3 money-path unification** —
Command pricing pinned to **$20/mo · $200/yr** across app + Shopify, a 10× mischarge defect
closed, cadence picker shipped; **(c)** the reset-hard incident residue reconstructed — graph
schema + intelligence constants restored to source, 150 tests green. The prior tracker's
"Open PR #263–#266 / PR #28" rows are long since merged/closed and have been removed.

Read alongside: `governance/OPEN-RISKS.md` (live risks, esp. R-21 graph deploy),
`governance/CAPABILITY-STATUS-REGISTER.md`, `governance/PASS3-BUILD-PLAN.md`,
`governance/Risk-Register.md`, `governance/decisions/DR-001-hydroscan-integration-and-launch-scope.md`,
`governance/Architecture-Appendix.md`, `governance/Section-62-Founder-Mode-Spec.md`.

---

## 1. Executive summary — is the app launch-ready?

**No — but the gap has narrowed and its shape has changed.** As of the prior refresh the app
was "built but everything's headless." Since then the two most user-visible programs shipped
**live**: the redesigned screens (default-ON) and the Command billing path (app + Shopify,
displayed = charged, price-pinned). What's left is now a shorter, sharper list — one unbooked
review, one commerce cutover, one infra deploy, and the still-headless personalization layer.

**Top 6 things that actually block launch, in order:**

1. **CR-1 (pre-launch claims/compliance review) still has no reviewer booked.** Unchanged
   since 2026-07-17. It gates RD-1 (§64 enable), the HydroScan efficiency%/superfood/urine
   claims, §20 surfacing copy, the personalization-copy audit (S56-1), and — per
   `OPEN-RISKS.md` R-24 — the per-locale intelligence-claims validation (only English is
   §42-validated; the launch locales ship product copy but need an 8-item review before any
   locale emits intelligence claims). **Still the single largest schedule risk** — most other
   open items are downstream of it.
2. **Commerce cutover is not proven end-to-end in production.** The Command path is built and
   pins price correctly (#380/#390/#392/#393/#398). The **Ritual "Save-10% displayed ≠
   charged"** mismatch is now **reconciled** (PR #405, pending merge — shop copy set to full
   price, "Save 10%" badges removed; verified live plan 2501607542 has no discount policy).
   Still open: (a) the Shopify→app entitlement bridge (#400/#402) is **source-only** until the
   DB deploy (see #4) and `SHOPIFY_WEBHOOK_SECRET` is set on Railway; (b) a live E2E round-trip
   on the deployed cart API is still a documented pre-reliance step.
3. **§20 flag-flip still has two unresolved sub-gates** even after CR-1: BLOCK-2 (under-18
   users get adult coefficients — founder + counsel) and COND-3 (surfacing copy —
   performance-scientist). `spec_section20_calibration` stays OFF until both clear.
4. **Graph / intelligence layer is definition-only — not deployed (R-21 OPEN).** The graph
   schema (`aforce_graph_nodes` / `aforce_graph_edges`) and the Stage 1–3 intelligence
   constants are restored to source with 150 tests green (#395/#396), but `drizzle-kit push`
   has never run — the tables exist in **no database**, there is no ingestion path, and there
   is no `DATABASE_URL` in this environment. `STAGE-2-GRAPH-SCHEMA-DEPLOYMENT-RUNBOOK.md` must
   be executed (six evidence items) before any graph-backed capability is real.
5. **Personalization is still headless.** §53–§56, §58–§61, §64, and PASS-3 slices 2/3/4c did
   not get user-facing surfaces this window (they shipped correct-but-invisible or default-OFF).
   If launch means "a user can see personalization working," that still needs the UI-wiring
   pass in Section 3 — not yet scoped/staffed.
6. **iOS purchase posture is a deliberate parked decision.** `ios_direct_checkout_enabled` is
   default-OFF (#403): iOS store builds route Command purchases to drinkaforce.com (App Store
   3.1.1 posture). Flipping to in-app external-purchase-link routing waits on counsel — a
   decision, not a build.

---

## 2. Build status table

Legend: **Shipped-live** (on by default, real users see it) · **Built-behind-flag (dark)**
(merged, code runs, gated OFF in `DEFAULT_FLAGS`) · **Source-only** (merged to source, no
runtime caller / no DB / no deploy) · **Not-built** (post-launch, no code) · **Phase-2**
(scoped, deferred by design).

| Section / feature | Status | Flag (if dark) | Notes |
|---|---|---|---|
| **Phase-3 redesigned screens** (Home, Hydration, Protocol, Coach V2, Community, Store, Cart, Subscription, Manage-Sub, Urine, Scan, Sweat, Profile, Onboarding, Auth, Science, Sensors, Legal, Leaderboard, Achievements, Notifications, Share) | **Shipped-live** | — (`spec_*` screen flags ON) | Redesign go-live. af.* token system; each screen internationalized (11 locales, en real copy) + screen-reader accessible |
| i18n coverage (react-i18next, 11 locales) | Shipped-live | — | #359–#375. Non-English are English-placeholder per repo convention; `fallbackLng:'en'`. R-24: only en §42-validated for intelligence claims |
| Accessibility pass (VoiceOver, roles/labels/state, Dynamic-Type, contrast) | Shipped-live | — | #370–#373. `af.redText` #E4564A for AA-clean red text/icons (fills keep frozen #C1281B); Icon default-hides decorative glyphs |
| §1–17 HydroState core | Shipped-live | — | Core scoring, untouched (off-limits) |
| §18–20 Adaptive Profile / Recalibration | Shipped-live (engine) | — | §20 coefficients feed Demand Engine only when `spec_section20_calibration` is on (OFF; BLOCK-2 + COND-3 gate the flip) |
| §28/§30/§31/§36/§37 HydroScan (base scan) | Shipped-live, advisory-only | — | DR-001: §35 amended advisory-only; only "Log Intake" writes score |
| §32/§33/§34/§29-OCR HydroScan 2.0 | Built-behind-flag (dark) | `hydro_scan_2_enabled` | DR-001 Decision 2: deferred scope. CR-1 is the enable gate, per-claim |
| **Command billing — app pricing** (D-1) | **Shipped-live** | — | #390: canonical paid tier = **Command $20/mo (2000¢)**; killed the $19.99 'Athlete' mismatch. Internal plan id stays `athlete` (live storage key). Existing subs unchanged; new price for new checkouts |
| **Command billing — annual cadence** (D-1) | **Shipped-live** | — | #392: **$200/yr** checkout path; `cadence` optional (legacy=monthly byte-identical); annual-on-monthly-only → 400, never silent fallback |
| **Checkout price pinning** | **Shipped-live (FIX-FIRST)** | — | #393: closed a 10× mischarge defect — Stripe lookup now matches `unit_amount` AND `interval` exactly, else fail-safe inline `price_data` |
| **Cadence picker** (upgrade UI) | **Shipped-live** | — | #398: upgrade tap → explicit $20/mo vs $200/yr choice. Cleared founder Stripe price audit |
| **Shop "Enter Command" (Shopify)** | **Shipped-live** | — | #379/#380: real Shopify IDs (variant `43905417838710`; monthly `2532999286`=$20, annual `2533032054`=$200), auto-renew disclosure; displayed = charged both cycles; revenue-guardian SHIP |
| **Shopify→app entitlement bridge** (D-2, slice 4c) | **Source-only** | — | #400: HMAC webhook + email-keyed bridge table + additive OR in `GET /entitlement` (never downgrades). Table source-only until R-21-style deploy + `SHOPIFY_WEBHOOK_SECRET` on Railway |
| **orders/paid bridge** | **Built** (source) | — | #402: `orders/paid` + Command-variant allowlist → rolling self-expiring grants (35d/370d). Bound: refund-then-keep-access ≤ one billing window until `orders/refunded` mapped |
| **iOS purchase posture** | **Built-behind-flag (dark)** | `ios_direct_checkout_enabled` (OFF) | #403: iOS store builds route Command purchases to drinkaforce.com (web→app bridge). Flip only after counsel confirms external-purchase-link posture (App Store 3.1.1) |
| Ritual subscription plan | Shipped-live (full price) | — | Plan 2501607542 kept at FULL price (founder 2026-07-26). Displayed ≠ charged Save-10% mismatch **reconciled** — shop copy set to full price, badges removed (PR #405, pending merge) |
| PASS-3 slice 1 — provider honesty (RC-L13) | **Shipped-live (UI)** | — | #387: wired `resolveHealthProviderStatus` into Profile rows. "LIVE" now requires verified + unexpired link; killed the fake-LIVE mock + demo-biometric seeding into score inputs |
| PASS-3 slice 2 — profile server hydration (RC-L11) | Built-behind-flag (dark) | `profile_server_hydration_enabled` (OFF) | #388: server rehydration + K-1 encrypted secure-store cache + reconnect flush. One-line flip after a physical-device reinstall test |
| PASS-3 slice 3 — intake corrections (RC-L12) | **Source-only** (route caller-less) | — (`intake_corrections_enabled` unbuilt) | #389: `POST /intake/correction` (append-only reversal) + §10 honesty columns. Undo UI deferred; schema source-only until runbook deploy |
| §53 Data Freshness | Shipped-live (engine) | — | Headless engine; no display surface yet (Section 3) |
| §54 Signal Quality | Built (headless util) | — (no flag, no UI consumer) | Grades source quality per signal; no surface reads it |
| §55 Profile Completeness (Steps 1–3) | Built (headless; nudge fires) | — | Nudge fires; underlying confidence math has no display surface |
| §56 Personalization Coverage resolver | Built (headless) | — | Pure qualifier; no UI shows which recs are population-default |
| §58 Command Confidence Display | Built-behind-flag (dark) | `spec_commandConfidenceDisplay` (**ON**), `command_confidence_adaptive_enabled` (OFF) | Badge flag is ON, but not wired into Today's Command / HydroScan Fit / Recovery Window / Sun Recovery — adaptive selection influence still gated |
| §59 Adaptive Response Engine | Built-behind-flag (dark) | `adaptive_response_enabled` (OFF) | Engine always derives; exposure gated |
| §60 Response Timeline | Built-behind-flag (dark) | `response_timeline_enabled` (OFF) | Also data-gated: needs 60–90 days personal history regardless of flag |
| §61 Living Performance Model | Built-behind-flag (dark) | `living_performance_enabled` (OFF) | Engine always derives; exposure gated |
| §62 Founder Mode / four-environment architecture | Not-built (spec only) | — | Spec complete; zero implementation. Post-launch, internal-only, never in Production build |
| §63 Guardian/Clutch/Cruise compliance pass | Shipped-live | — | Streak-loss language fixed org-wide. R63-1/R63-2 remain Phase-2 |
| §64 Conversational Intelligence | Built-behind-flag (dark) | `conversational_intelligence_enabled` (OFF) | **RD-1 pending**: stays OFF until CR-1 clears coach copy |
| Graph schema (§38 `aforce_graph_nodes`/`_edges`) | **Source-only — NOT deployed** | — | #395: defined in `lib/db`; `drizzle-kit push` never run; exists in no DB. **R-21 OPEN** |
| Intelligence constants (Stage 1–3 contracts, PKG builder/query, §42 gate) | **Source-only**, 150 tests green | — | #396: incident residue closed; app typecheck clean. Stages 1–3 officially "Partially Built" |
| Demand Engine (`hydrationDemandSelector`) | Built-behind-flag (dark) | `spec_demand_engine` (OFF) | Pure module, no visible consumer |
| Evidence Engine ("Why this command") | Built-behind-flag (dark) | `evidence_engine_enabled` (OFF) | Headless explainability layer |
| Performance Memory (execution + governance view) | Built-behind-flag (dark) | `performance_memory_execution_enabled`, `performance_memory_governance_enabled` (both OFF) | — |
| Location Intelligence | Built-behind-flag (dark) | `location_intelligence_enabled` (OFF) | Advisory only |
| Signal Hierarchy | Built-behind-flag (dark) | `signal_hierarchy_enabled` (OFF) | Freshest-wins stays live while off |
| Weekly Performance Report | Built-behind-flag (dark) | `spec_weekly_report` (**ON**) | Flag ON in `DEFAULT_FLAGS`; verify surface reach before relying on it |
| Performance Identity (raw-signal readout) | Built-behind-flag (dark) | `performance_identity_enabled` (OFF) | Classifier inert regardless — no archetype logic exists yet |
| Score-from-Ledger Hybrid | Built-behind-flag (dark), off even in demo | `scoreFromLedgerHybrid` (OFF everywhere) | Shadow-compare only; contribution-level parity not yet proven |
| Personal Baseline™ primitive | Not-built | — | Post-launch behind ruling ④ — needs cybersecurity + counsel before any persistence of learned physiological data |

---

## 3. "Show 10" surface backlog — headless layers needing UI to reach users

Everything below is **built and correct** but invisible (or flag-off) to a real user. Each
line needs a **ui-designer** pass plus the named gate before it can ship visible. This
backlog is materially unchanged since the prior refresh — the redesign go-live added screens,
not personalization surfaces.

| Layer | What's missing | Gate before visible |
|---|---|---|
| §53 Data Freshness | No surface shows "how fresh is this reading" | None outstanding — UI-only work |
| §54 Signal Quality | No surface shows per-signal source quality (Excellent/Good/Limited/Unavailable) | None outstanding — UI-only work |
| §55 Profile Completeness → Confidence | Nudge fires; the confidence badge/explanation has no display surface | None outstanding — UI-only work |
| §56 Personalization Coverage | Resolver reports personalized / population-default / blocked-on-input / scoring-locked per field — no UI shows which recs are population-default | S56-1 copy audit (CR-1) |
| §58 Command Confidence Display | `spec_commandConfidenceDisplay` is ON, but the badge is not wired into Today's Command, HydroScan Fit, Recovery Window, Sun Recovery | Wire into the four surfaces; adaptive influence stays gated |
| §59/§60/§61 (Adaptive Response / Response Timeline / Living Performance) | Personal Response Library, timeline results, daily lesson have no consuming screen | §60 additionally data-gated (60–90 days history) |
| PASS-3 slice 2 — profile hydration | Server rehydration built; needs a physical-device reinstall test to flip `profile_server_hydration_enabled` | Device reinstall test (one-line flip) |
| PASS-3 slice 3 — intake corrections | `POST /intake/correction` has no caller; Undo UI unbuilt behind an unbuilt flag | Build `intake_corrections_enabled` + Undo UI; DB deploy |
| §64 Conversational Intelligence | Proactive + reactive coach live in the voice layer behind the flag; audible behavior gated by RD-1/CR-1, not missing UI | CR-1, then RD-1 go/no-go |

**Recommendation:** batch §53/§54/§55/§56/§58 into one ui-designer engagement — they compose
at the same display layer (confidence/personalization badges across HydroState, Command,
Profile) rather than five separate UI projects.

---

## 4. Open decisions & gates

| Item | Owner | What it blocks | Status |
|---|---|---|---|
| **CR-1** — pre-launch claims/compliance review | Brandon + performance-scientist (+ counsel on edges) | RD-1 (§64); HydroScan efficiency%/superfood/urine claims; §20 surfacing copy (COND-3); S56-1 personalization copy; R-24 per-locale claims | **OPEN — no reviewer booked** (since 2026-07-17). Human action #1 |
| **Ritual Save-10% displayed ≠ charged** | Brandon + revenue-guardian | Commerce cutover trust | **RESOLVED 2026-07-31 (PR #405, pending merge)** — shop copy set to full price ($59.99/$29.99), "Save 10%" badges removed; verified plan 2501607542 has no discount policy. Was pre-launch, no customer charged |
| **R-21** — graph schema DB deploy | devops + backend | Any graph-backed intelligence capability (Stages 1–3 real) | **OPEN** — `drizzle-kit push` never run; no `DATABASE_URL`; six runbook evidence items outstanding |
| **`SHOPIFY_WEBHOOK_SECRET` on Railway** | devops | #400/#402 Shopify→app entitlement bridge going live | **OPEN** — env not set; bridge source-only until then |
| **iOS external-purchase-link posture** | Brandon + counsel | `ios_direct_checkout_enabled` flip | **OPEN (parked)** — default routes to web (App Store 3.1.1 compliant); no launch blocker while OFF |
| **RD-1** — enable §64 in production | Brandon (decision) | Nothing else; §64 stays OFF until CR-1 clears | PENDING-DECISION, gated on CR-1 |
| **§20 BLOCK-2** — under-18 gets adult coefficients | Founder + counsel | `spec_section20_calibration` flip | OPEN |
| **§20 COND-3** — surfacing copy | performance-scientist | Same flip | OPEN |
| **R63-1 / R63-2** — comparative streak / Athlete Mode decay | Phase-2 / streak-owner | Nothing pre-launch — Phase-2 only | Design decided; deferred |
| **Personal Baseline™ primitive** | Cybersecurity + counsel (ruling ④) | Nothing pre-launch — post-launch by design | Locked |
| **§62 Q5** — competitor-failure scenario physiology | performance-scientist + outside counsel | §62 M7 build (post-launch) | Standing, no expiry |

---

## 5. Human action items — called out first, exact action

These do not self-surface. Listed first per standing scrum-master discipline.

1. **Book the regulatory/claims reviewer for CR-1.** Still unscheduled since 2026-07-17. The
   critical-path blocker — every other claims/copy gate resolves through it. **Sole standing
   human action from the prior refresh; still open.**
2. **Set `SHOPIFY_WEBHOOK_SECRET` on Railway and run the graph/entitlement DB deploy** (R-21
   runbook). Unblocks both the Shopify entitlement bridge (#400/#402) and the graph layer
   (#395/#396) in one deploy pass.
3. **Decide the iOS purchase posture with counsel** — keep web-routing (current, compliant)
   or flip `ios_direct_checkout_enabled`. Non-blocking while OFF, but decide before the store
   submission narrative is finalized.

*Resolved 2026-07-31:* the Ritual "Save-10% displayed ≠ charged" mismatch — shop copy set to
full price and the "Save 10%" badges removed (PR #405, pending merge). No longer a human
action; the founder's full-price ruling is now reflected in what the shop displays.

---

## 6. Production flag inventory — `DEFAULT_FLAGS` (verified 2026-07-31)

Source: `artifacts/aforce-os/featureFlags/flags.ts`.

**ON by default (live in the production binary):**

- Redesigned screens: `spec_home`, `spec_hydration`, `spec_protocol`, `spec_coachV2`,
  `spec_community`, `spec_store`, `spec_cart`, `spec_subscription`, `spec_manageSub`,
  `spec_urine`, `spec_scan`, `spec_sweat`, `spec_profile`, `spec_onboarding`, `spec_auth`,
  `spec_science`, `spec_sensors`, `spec_legal`, `spec_leaderboard`, `spec_achievements`,
  `spec_notifScreen`, `spec_share`
- Core spec: `spec_activation`, `spec_social`, `spec_recoveryCircle`, `spec_notifications`,
  `spec_orb`, `spec_timelineLock`, `spec_hydroJournal`, `spec_hydroScan`, `spec_profileSource`,
  `spec_sharedContextLayer`, `spec_uiFreeze`, `spec_commandConfidenceDisplay`,
  `spec_confidenceDetailSheet`, `spec_weekly_report`
- Competition: `city_competition_enabled`, `state_competition_enabled`,
  `team_competition_enabled`, `global_leaderboard_enabled`
- Modes / stability: `cruise_mode_enabled` (master ON, all `cruise_*` sub-features OFF),
  `sleep_mode_enabled`, `secure_store_startup_guard`

**OFF by default (dark) — grouped by why:**

| Flag(s) | Why it's off |
|---|---|
| `ios_direct_checkout_enabled` | Money-path posture — web-routing until counsel clears external purchase links (App Store 3.1.1) |
| `profile_server_hydration_enabled` | PASS-3 slice 2 — awaits physical-device reinstall test |
| `spec_section20_calibration` | §20 → Demand snapshot — flip gated on BLOCK-2 + COND-3 |
| `conversational_intelligence_enabled` | §64 — RD-1 pending; gated on CR-1 |
| `hydro_scan_2_enabled` | HydroScan 2.0 — DR-001 post-launch, CR-1 per claim |
| `spec_demand_engine`, `evidence_engine_enabled`, `command_confidence_adaptive_enabled`, `adaptive_response_enabled`, `response_timeline_enabled`, `living_performance_enabled`, `performance_memory_execution_enabled`, `performance_memory_governance_enabled`, `performance_identity_enabled`, `scoreFromLedgerHybrid` | Intelligence engines — headless, no consumer surface / parity unproven |
| `location_intelligence_enabled`, `signal_hierarchy_enabled` | Advisory; freshest-wins stays live while off |
| `spec_recovery`, `spec_recoveryCoach`, `spec_profileStrengthSection`, `spec_sleep`, `spec_cruise`, `spec_premium`, `spec_inventory` | Phase-2/later-phase surfaces |
| `spec_phantom`, `spec_enterprise`, `spec_language_*` (ar/zh/ja/ko/hi) | Out of launch scope, later phases |
| all `clutch_*`, all `guardian_*`, all `cruise_*` sub-features | Phase-2/3 |
| `metabolic_readiness_enabled`, `metabolic_glucose_enabled`, `performance_age_enabled`, `voice_checkin_enabled`, `intent_capture_enabled`, `performance_statements_enabled`, `offline_intake_outbox_enabled`, `voice_status_module_visible` | Athlete tier / voice / offline — out of launch scope |
| `phantom_wearable_enabled`, `ring_enabled`, `kids_world_enabled`, `demo_mode_enabled` | Not launch-scope |
| `healthkit_native_enabled`, all `health_*_direct`/`_connect`/`_demo_data` provider gates | Provider integrations gated; demo data off |
| `native_tabs_enabled`, `native_screens_enabled` | iOS 26 crash isolation (react-native-screens #3940) — stability workaround, re-enable only when upstream fix confirmed |

**Note:** `DEMO_ALL_ON_FLAGS` lights nearly all of the above for internal/investor builds, but
keeps `scoreFromLedgerHybrid`, `profile_server_hydration_enabled`, `healthkit_native_enabled`,
`native_tabs_enabled`/`native_screens_enabled`, and per-provider health gates OFF even in demo.
Always verify at build-profile level, not just this file, before assuming public users see a flag.

---

*Doctrine note (carried from 2026-07-18): cross-check `gh pr list --state open` against the
sprint's stated open-PR list every session, not just the PRs named in the ask — an open PR
nobody mentions is itself a risk-register entry. At this refresh there are **zero open PRs**.*
