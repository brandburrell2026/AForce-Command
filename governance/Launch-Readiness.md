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

**CR-1 update 2026-07-31 (PRs #405–#419):** the pre-launch claims layer is now prepped and
conservatively remediated — cited reviewer package + internal scientific pass + ER-5 citation
verification; every live-flagged claim fixed / held / genericized; both ER-5 citation
mismatches fixed. **No unsubstantiated claim currently ships.** The external regulatory review
itself is still **unbooked** (the remaining gate); the reviewer outreach and supplier-evidence
request are **finalized and one field from sent** in `governance/reviews/`. See §1 / §4 / §5.

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
review, one commerce cutover, one infra deploy, and a **partly-shipped** personalization layer
(its confidence/display surfaces are now live; only the deeper adaptive engines stay dark).

**Top 6 things that actually block launch, in order:**

1. **CR-1 (pre-launch claims/compliance review) — claims remediated, external review still
   unbooked.** The acute risk is materially reduced: as of 2026-07-31 the full claims layer is
   prepped and conservatively remediated (PRs #405–#419) — a cited reviewer package + internal
   scientific-substantiation pass; every live-flagged claim **fixed, held, or genericized**
   (marketing "Heat Guard" fixed + deployed; §2 hard-stops removed; urine verdicts
   observation-only; competitor table genericized; "72 minerals" / "4-hour window" held pending
   evidence; both ER-5 citation mismatches fixed). **No unsubstantiated claim currently ships.**
   What remains is the **external regulatory review itself**, still unbooked — it gates RD-1
   (§64 enable), the HydroScan flag flips, *restoring* the held claims, and the R-24 per-locale
   validation. Reviewer outreach + supplier-evidence request are **finalized and one field from
   sent** (`governance/reviews/`), so booking is a send-away. Still the top **schedule** item
   (review lead time), but no longer
   an acute claims-exposure risk.
2. **Commerce cutover is not proven end-to-end in production.** The Command path is built and
   pins price correctly (#380/#390/#392/#393/#398). The **Ritual "Save-10% displayed ≠
   charged"** mismatch is **closed** — reconciled (PR #405), **deployed live**, and **verified
   matching** 2026-07-31: `drinkaforce.com/shop` displays $59.99/$29.99 with no "Save 10%", and
   the Shopify storefront `shop.drinkaforce.com` charges the same via plan 2501607542
   (`per_delivery_price` = variant price, `compare_at_price: null`, no discount policy) —
   displayed = charged = configured across all three surfaces. Still open on commerce: (a) the
   Shopify→app entitlement bridge (#400/#402) is **source-only** until the DB deploy (see #4)
   and `SHOPIFY_WEBHOOK_SECRET` is set on Railway; (b) a live E2E cart round-trip (add →
   checkout → entitlement) on the deployed cart API is still a documented pre-reliance step —
   pricing is verified, the transactional round-trip is not.
3. **§20 flag-flip still has two unresolved sub-gates** even after CR-1: BLOCK-2 (under-18
   users get adult coefficients — founder + counsel) and COND-3 (surfacing copy —
   performance-scientist). `spec_section20_calibration` stays OFF until both clear.
4. **Graph / intelligence layer — schema deployed (founder-attested), but not yet a working
   capability.** The graph schema (`aforce_graph_nodes` / `aforce_graph_edges`) + Stage 1–3
   constants are in source with 150 tests green (#395/#396), and the **schema is now deployed to
   production per founder attestation 2026-07-31 (R-21 closed on attestation** — `\d`/`\di`/smoke
   output not independently captured in-repo). What remains is **not** the deploy but the layer
   above it: **no ingestion path / no runtime caller** writes to or reads from the graph yet —
   deployed tables ≠ a graph-backed capability. That wiring is post-launch intelligence work.
5. **Personalization — display layer SHIPPED; only the deeper engines stay dark. (Corrected
   2026-07-31 — the prior "everything headless" claim was stale.)** The **Show-10
   confidence/personalization display layer is live**: the **Command Confidence badge**
   (`spec_commandConfidenceDisplay` ON) renders on Social, Cruise, and Product-Fit/HydroScan, and
   the **"DATA BEHIND THIS" signal-quality sheet** (`spec_confidenceDetailSheet` ON) is live on
   HydroScan — components wired into 8 surfaces (PRs #278/#279 + the confidence-system ruling).
   Still dark: the **Profile Strength section** (§55, `spec_profileStrengthSection` OFF in prod /
   ON in demo) and the **§59–61 adaptive/timeline/living engines + §64** (flags OFF). So "a user
   sees personalization working" is now largely TRUE on the confidence surfaces; what remains is
   the profile-strength flag flip + the adaptive engines — a much smaller gap than previously stated.
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
| Ritual subscription plan | Shipped-live (full price) | — | Plan 2501607542 kept at FULL price (founder 2026-07-26). Displayed ≠ charged Save-10% mismatch **closed** — reconciled (PR #405), deployed live, verified 2026-07-31: displayed = charged = configured ($59.99/$29.99) across marketing + `shop.drinkaforce.com` storefront + Admin |
| PASS-3 slice 1 — provider honesty (RC-L13) | **Shipped-live (UI)** | — | #387: wired `resolveHealthProviderStatus` into Profile rows. "LIVE" now requires verified + unexpired link; killed the fake-LIVE mock + demo-biometric seeding into score inputs |
| PASS-3 slice 2 — profile server hydration (RC-L11) | Built-behind-flag (dark) | `profile_server_hydration_enabled` (OFF) | #388: server rehydration + K-1 encrypted secure-store cache + reconnect flush. One-line flip after a physical-device reinstall test |
| PASS-3 slice 3 — intake corrections (RC-L12) | **Source-only** (route caller-less) | — (`intake_corrections_enabled` unbuilt) | #389: `POST /intake/correction` (append-only reversal) + §10 honesty columns. Undo UI deferred; schema source-only until runbook deploy |
| §53 Data Freshness | Shipped-live | — | Surfaced in the "DATA BEHIND THIS" sheet (`spec_confidenceDetailSheet` ON) |
| §54 Signal Quality | **Shipped-live** | `spec_confidenceDetailSheet` (**ON**) | Per-signal source quality surfaced in the DATA BEHIND THIS sheet on HydroScan (corrected 2026-07-31 — was mislabeled headless) |
| §55 Profile Completeness (Steps 1–3) | Built-behind-flag (dark) | `spec_profileStrengthSection` (OFF prod / ON demo) | Resolver + nudge live; the Profile Strength display card is gated OFF in prod |
| §56 Personalization Coverage resolver | Built; feeds confidence surfaces | — | Resolver merged (#feat/section-56); feeds the confidence chips. No dedicated "population-default per field" display |
| §58 Command Confidence Display | **Shipped-live** | `spec_commandConfidenceDisplay` (**ON**); `command_confidence_adaptive_enabled` (OFF) | Badge wired + live on **Social, Cruise, Product-Fit/HydroScan** (corrected 2026-07-31 — was mislabeled "not wired"). Adaptive *selection* influence still gated |
| §59 Adaptive Response Engine | Built-behind-flag (dark) | `adaptive_response_enabled` (OFF) | Engine always derives; exposure gated |
| §60 Response Timeline | Built-behind-flag (dark) | `response_timeline_enabled` (OFF) | Also data-gated: needs 60–90 days personal history regardless of flag |
| §61 Living Performance Model | Built-behind-flag (dark) | `living_performance_enabled` (OFF) | Engine always derives; exposure gated |
| §62 Founder Mode / four-environment architecture | Not-built (spec only) | — | Spec complete; zero implementation. Post-launch, internal-only, never in Production build |
| §63 Guardian/Clutch/Cruise compliance pass | Shipped-live | — | Streak-loss language fixed org-wide. R63-1/R63-2 remain Phase-2 |
| §64 Conversational Intelligence | Built-behind-flag (dark) | `conversational_intelligence_enabled` (OFF) | **RD-1 pending**: stays OFF until CR-1 clears coach copy |
| Graph schema (§38 `aforce_graph_nodes`/`_edges`) | **Deployed to prod (founder-attested 2026-07-31)** | — | #395 defined + typecheck-verified; **R-21 closed on founder attestation** (`\d`/`\di`/smoke output not independently captured in-repo). No ingestion path yet — deployed schema ≠ working capability |
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

## 3. "Show 10" surface backlog — **mostly DELIVERED** (corrected 2026-07-31)

**This section was stale.** The Show-10 confidence/personalization display layer shipped
(PRs #278/#279 + the confidence-system ruling; `ConfidenceChip` / `DataBehindThisSheet` /
`CommandConfidenceBadge` wired into 8 surfaces). The prior "materially unchanged / invisible"
framing was wrong. Current state:

| Layer | Status | Note |
|---|---|---|
| §53 Data Freshness | ✅ **Delivered** | Shown in the DATA BEHIND THIS sheet (`spec_confidenceDetailSheet` ON) |
| §54 Signal Quality | ✅ **Delivered** | Per-signal source quality in the DATA BEHIND THIS sheet on HydroScan |
| §58 Command Confidence Display | ✅ **Delivered** | Badge live on Social / Cruise / Product-Fit/HydroScan (`spec_commandConfidenceDisplay` ON) |
| §55 Profile Completeness → Confidence | ⚙️ Built, **flag-off in prod** | Profile Strength card behind `spec_profileStrengthSection` (ON in demo only) — a flag flip, not a build |
| §56 Personalization Coverage | ⚙️ Resolver merged, feeds confidence | No dedicated "which recs are population-default" display; low priority |
| §59–§61 / §64 (adaptive engines) | ⛔ Dark | Separate deeper layer — flags OFF (§64 gated on RD-1/CR-1); the genuine remaining personalization work |
| §59/§60/§61 (Adaptive Response / Response Timeline / Living Performance) | Personal Response Library, timeline results, daily lesson have no consuming screen | §60 additionally data-gated (60–90 days history) |
| PASS-3 slice 2 — profile hydration | Server rehydration built; needs a physical-device reinstall test to flip `profile_server_hydration_enabled` | Device reinstall test (one-line flip) |
| PASS-3 slice 3 — intake corrections | `POST /intake/correction` has no caller; Undo UI unbuilt behind an unbuilt flag | Build `intake_corrections_enabled` + Undo UI; DB deploy |
| §64 Conversational Intelligence | Proactive + reactive coach live in the voice layer behind the flag; audible behavior gated by RD-1/CR-1, not missing UI | CR-1, then RD-1 go/no-go |

**Recommendation (updated):** the confidence display layer (§53/§54/§58) is **done**. The only
remaining personalization UI decisions are (a) flip `spec_profileStrengthSection` ON in prod
once its gate clears (§55), and (b) decide whether §59–§61/§64 (the adaptive engines) get
surfaces for launch — that is the real remaining scope, and it is gated on RD-1/CR-1 for §64.

---

## 4. Open decisions & gates

| Item | Owner | What it blocks | Status |
|---|---|---|---|
| **CR-1** — pre-launch claims/compliance review | Brandon + performance-scientist (+ counsel) | RD-1 (§64 enable); HydroScan flag flips; *restoring* held claims (ER-1/ER-2); R-24 per-locale | **PREP COMPLETE, review UNBOOKED** — claims remediated (PRs #405–#419; no unsubstantiated claim ships); reviewer package + outreach + supplier-evidence request all **finalized (one field from sent)** in `governance/reviews/`. Booking/engaging counsel is the open step. Human action #1 |
| **Ritual Save-10% displayed ≠ charged** | Brandon + revenue-guardian | Commerce cutover trust | **CLOSED 2026-07-31 (PR #405, deployed live + verified)** — shop copy set to full price ($59.99/$29.99), "Save 10%" badges removed; `shop.drinkaforce.com` storefront charges the same (no discount policy, `compare_at` null). Displayed = charged across all surfaces. Was pre-launch, no customer charged |
| **R-21** — graph schema DB deploy | devops + backend | Any graph-backed intelligence capability (Stages 1–3 real) | **RESOLVED (founder-attested) 2026-07-31** — closed on founder attestation of a production deploy; recorded in `OPEN-RISKS.md` R-21 + runbook §11 + capability register. `\d`/`\di`/smoke output not independently captured in-repo → re-open on any graph-query failure. Optional: capture that output to upgrade to fully-verified |
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

1. **Send the CR-1 reviewer outreach + supplier request / engage counsel.** All prep is done and
   the claims are conservatively remediated (no unsubstantiated claim ships), so this is a
   send-away, not a scramble. **Both outreaches are finalized:** the reviewer outreach
   (`governance/reviews/CR-1-REVIEWER-OUTREACH.md` — AWG scope-check w/ September filled + a
   cold-specialist note) and the supplier evidence request (`CR-1-SUPPLIER-EVIDENCE-REQUEST.md` —
   product/SKU filled) are each **one field from sent** (recipient name only); the cited worksheet
   (`CR-1-CLAIMS-REVIEW-PACKAGE.md`) is the scope-of-work to hand over under engagement. Sending
   them + engaging the reviewer is the remaining human action. **ER-5 citation check done +
   fixes applied 2026-07-31** — the primary-source check + a performance-scientist pass corrected
   all 3 items in copy (Baker "Table 2"→"Figure 2" + range → 10–90 mmol/L; Maughan →
   `20(Suppl 2):59–69`; §C/§G/§F → paper-level coords), across 11 locales + screen + comments.
   `data/sweatSports.ts` per-sport provenance reconciled 2026-07-31 — citation fixes applied
   (8 sports were mis-cited to Baker 2017, now correctly sourced); founder value decisions made
   (Hot Yoga 0.85→1.0 **applied**, cited Alrefai 2020; Basketball **kept 1.38**). CrossFit locus now
   resolved (Cronin 2016) — **ER-5 fully closed**, every Sweat Calculator citation traced to a
   verified source.
2. **Confirm `SHOPIFY_WEBHOOK_SECRET` is set on Railway** so the Shopify entitlement bridge
   (#400/#402) is actually live, not just the graph tables. (R-21 graph-schema deploy is now
   closed on founder attestation — 2026-07-31; optionally capture the `\d`/`\di`/smoke output to
   upgrade R-21 from founder-attested to fully-verified.) Also confirm **D-08's
   `hydrostate_model_version` column** deployed (not separately attested).
3. **Decide the iOS purchase posture with counsel** — keep web-routing (current, compliant)
   or flip `ios_direct_checkout_enabled`. Non-blocking while OFF, but decide before the store
   submission narrative is finalized.

*Resolved 2026-07-31:* the Ritual "Save-10% displayed ≠ charged" mismatch — shop copy set to
full price and the "Save 10%" badges removed (PR #405), **deployed live and verified** that
`drinkaforce.com/shop` and the `shop.drinkaforce.com` storefront now charge the same
($59.99/$29.99, no discount policy). No longer a human action; the founder's full-price ruling
is now reflected in what the shop both displays and charges.

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
