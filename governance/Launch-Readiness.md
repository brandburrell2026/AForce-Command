# AForce OS — Launch Readiness Tracker

Maintained by **scrum-master**. Consolidates what blocks the September 2026 launch across
all workstreams. Verified against `main` @ `d44fc159` (2026-07-18).

**Update 2026-07-18:** PRs #263–#266 **merged** (the build-status rows below that say
"Open PR …" are now on `main`). Stale **PR #28 closed as superseded** (its one unique idea —
app-wide proactive coaching — captured in §4). Joseph's email **descoped** (unrelated to
AForce OS, per founder).

Read alongside: `governance/Risk-Register.md` (live decisions/gates), `governance/decisions/DR-001-hydroscan-integration-and-launch-scope.md`,
`governance/Architecture-Appendix.md`, `governance/Section-62-Founder-Mode-Spec.md`.

---

## 1. Executive summary — is the app launch-ready?

**No — not blocked on engineering, blocked on two human actions and one review that hasn't
been booked.** The build is ahead of schedule: everything committed for the current sprint
(§18–20, §53–55, §58–64, DR-001, §62 spec) is done. The gap between "built" and
"launch-ready" is almost entirely **decisions and copy review**, not code.

**Top 5 things that actually block launch, in order:**

1. **CR-1 (pre-launch claims/compliance review) has no reviewer booked.** It gates RD-1
   (§64 enable), the HydroScan efficiency%/superfood/urine claims, §20 surfacing copy, and
   the personalization-copy audit (S56-1). Nothing on that list can ship until this happens,
   and it hasn't been scheduled. **This is the single largest risk to the September date** —
   everything else on this list is either done or waiting on this one review.
2. **§20 flag-flip has two unresolved sub-gates** even after CR-1: BLOCK-2 (under-18 users
   get adult coefficients — needs founder + counsel) and COND-3 (surfacing copy — needs
   performance-scientist). Neither is scheduled.
3. **Everything shipped so far is headless.** §53/§54/§55/§56 and Command Confidence Display
   have zero UI consumers. If launch means "a user can see personalization working," that
   requires a UI-wiring pass (Section 3 below) that has not been scoped or staffed yet.

CR-1 remains **the** single largest risk to the September date; everything else is done or
downstream of it.

---

## 2. Build status table

Legend: **Shipped-live** (on by default, real users see it) · **Built-behind-flag (dark)**
(merged, code runs, gated OFF in `DEFAULT_FLAGS`) · **Not-built** (post-launch, no code) ·
**Phase-2** (scoped, deferred by design).

| Section / feature | Status | Flag (if dark) | Notes |
|---|---|---|---|
| §1–17 HydroState core | Shipped-live | — | Core scoring, untouched (off-limits) |
| §18–20 Adaptive Profile / Recalibration | Shipped-live (engine) | — | Merged this session. §20 coefficients feed Demand Engine only when `spec_section20_calibration` is on (see below) |
| §28/§30/§31/§36/§37 HydroScan (base scan) | Shipped-live, advisory-only | — | DR-001: §35 amended advisory-only; only "Log Intake" writes score |
| §32/§33/§34/§29-OCR HydroScan 2.0 | Built-behind-flag (dark) | `hydro_scan_2_enabled` | DR-001 Decision 2: deferred scope, not a defect. CR-1 is the enable gate, per-claim |
| §53 Data Freshness | Shipped-live (engine) | — | Merged this session |
| §54 Signal Quality | Built-behind-flag (dark) | — (headless util, no flag — no UI consumer yet) | Grades source quality per signal; feeds Data Confidence. No surface reads it yet |
| §55 Profile Completeness (Steps 1–3) | Built-behind-flag (dark) | — (headless; nudge logic merged) | Resolver + confidence adapter + nudge, all merged. Nudge fires; underlying confidence math has no display surface |
| §56 Step 1 — Personalization Coverage resolver | **Open PR #264**, not on main | — (headless) | Pure qualifier, 12 tests green. Awaiting merge |
| §56 Step 2 — §20 calibration → Demand snapshot | **Open PR #265**, not on main | `spec_section20_calibration` (OFF) | BLOCK-1 (sodium ceiling) resolved in-PR; BLOCK-2 (under-18) and COND-3 (copy) gate the future flip, not the merge |
| §56 governance locks (CR-1 copy audit, RL-1 reserved) | **Open PR #263**, not on main | — (docs only) | Zero code risk, should merge immediately |
| §58 Command Confidence Display | Built-behind-flag (dark) | `spec_commandConfidenceDisplay` (OFF) | Merged this session. UI badge component exists; not wired to Today's Command / HydroScan Fit / Recovery Window / Sun Recovery yet |
| §59 Adaptive Response Engine | Built-behind-flag (dark) | `adaptive_response_enabled` (OFF) | Merged this session |
| §60 Response Timeline | Built-behind-flag (dark) | `response_timeline_enabled` (OFF) | Merged this session. Also data-gated: needs 60–90 days personal history before it's meaningful regardless of flag |
| §61 Living Performance Model | Built-behind-flag (dark) | `living_performance_enabled` (OFF) | Merged this session |
| §62 Founder Mode / four-environment architecture | Not-built (spec only) | — | Spec complete (`Section-62-Founder-Mode-Spec.md`), zero implementation. Post-launch, internal-only, never in Production build |
| §63 Guardian/Clutch/Cruise compliance pass | Shipped-live | — | Merged this session — streak-loss language fixed org-wide |
| §63 follow-ups: R63-1 (comparative streak) | Phase-2 | — | Design decided (rank decouples from streak); no code, not launch-runway |
| §63 follow-ups: R63-2 (Athlete Mode decay) | Phase-2 / backend-owned | — | Needs upstream `complianceStreak` change (not app-side); gated on perf-scientist mechanic review |
| §64 Conversational Intelligence (proactive + reactive) | Built-behind-flag (dark) | `conversational_intelligence_enabled` (OFF) | Steps 1–4 merged this session. **RD-1 pending-decision**: stays OFF until CR-1 clears coach copy |
| §64 voice-wiring (PR #28) | **Open PR #28**, stale 13 days | `conversational_intelligence_enabled` (OFF, unaffected) | Not merged, not superseded, not on the current sprint's radar — see escalation §4 |
| Demand Engine (`hydrationDemandSelector`) | Built-behind-flag (dark) | `spec_demand_engine` (OFF) | Pure module, zero visible consumer |
| Evidence Engine ("Why this command") | Built-behind-flag (dark) | `evidence_engine_enabled` (OFF) | Headless explainability layer |
| Performance Memory (execution + governance view) | Built-behind-flag (dark) | `performance_memory_execution_enabled`, `performance_memory_governance_enabled` (both OFF) | — |
| Location Intelligence | Built-behind-flag (dark) | `location_intelligence_enabled` (OFF) | Advisory only |
| Signal Hierarchy | Built-behind-flag (dark) | `signal_hierarchy_enabled` (OFF) | Freshest-wins stays live while off |
| Weekly Performance Report | Built-behind-flag (dark) | `spec_weekly_report` (OFF) | — |
| Performance Identity (raw-signal readout) | Built-behind-flag (dark) | `performance_identity_enabled` (OFF) | Classifier inert regardless — no archetype logic exists yet |
| Score-from-Ledger Hybrid | Built-behind-flag (dark), off even in demo | `scoreFromLedgerHybrid` (OFF everywhere) | Shadow-compare only; contribution-level parity not yet proven |
| Personal Baseline™ primitive | Not-built | — | Post-launch behind ruling ④ — needs cybersecurity + counsel before any persistence of learned physiological data |

---

## 3. "Show 10" surface backlog — headless layers needing UI to reach users

Everything below is **built and correct** but invisible to a real user. Each line needs a
**ui-designer** pass plus the named gate before it can ship visible.

| Layer | What's missing | Gate before visible |
|---|---|---|
| §53 Data Freshness | No surface shows "how fresh is this reading" | None outstanding — UI-only work |
| §54 Signal Quality | No surface shows per-signal source quality (Excellent/Good/Limited/Unavailable) | None outstanding — UI-only work |
| §55 Profile Completeness → Confidence | Nudge fires; the underlying confidence badge/explanation has no display surface | None outstanding — UI-only work |
| §56 Personalization Coverage | Resolver reports personalized / population-default / blocked-on-input / scoring-locked per field — no UI shows the user which of their recommendations are population-default | Merge #264 first |
| §58 Command Confidence Display | Badge component exists; not wired into Today's Command, HydroScan Performance Fit, Recovery Window, Sun Recovery | Internal-preview sign-off (per flag comment in `flags.ts`) |
| §59/§60/§61 (Adaptive Response / Response Timeline / Living Performance) | Personal Response Library, timeline query results, and daily lesson have no consuming screen | §60 additionally data-gated (60–90 days history) independent of UI work |
| §64 Conversational Intelligence | Proactive + reactive coach logic is live in the voice layer behind the flag; no UI change needed, but audible behavior is gated by RD-1/CR-1, not by missing UI | CR-1 (claims review), then RD-1 go/no-go |

**Recommendation:** batch §53/§54/§55/§56/§58 into one ui-designer engagement — they compose
at the same display layer (confidence/personalization badges across HydroState, Command,
Profile) rather than five separate UI projects. §64 does not need this backlog; it needs CR-1.

---

## 4. Open decisions & gates

| Item | Owner | What it blocks | Age |
|---|---|---|---|
| **CR-1** — pre-launch claims/compliance review | Brandon + performance-scientist (+ counsel on edges) | RD-1 (§64 enable); HydroScan efficiency%/superfood/urine claims; §20 surfacing copy (COND-3); S56-1 personalization-copy audit | Opened session 2026-07-17. **No reviewer booked — see human action #1** |
| **RD-1** — enable §64 in production | Brandon (decision) | Nothing else; §64 stays OFF regardless until CR-1 clears | PENDING-DECISION, gated on CR-1 |
| **§20 BLOCK-2** — under-18 gets adult coefficients | Founder + counsel | `spec_section20_calibration` flip | Opened with PR #265 (unmerged) |
| **§20 COND-3** — surfacing copy | performance-scientist | Same flip | Opened with PR #265 (unmerged) |
| **RL-1** — field-must-enter-score, reserved | Locked (no owner needed) | Nothing pre-launch — permanently deferred, never re-litigate pre-launch | Locked in PR #263 (unmerged) |
| **R63-1** — comparative streak surfaces | Phase 2 (react-native-engineer + performance-scientist) | Nothing pre-launch — design decided, Phase 2 only | Opened session 2026-07-17 |
| **R63-2** — Athlete Mode decay mechanic | Backend / streak-owner | Nothing pre-launch — upstream mechanic change, gated on perf-scientist review of the mechanic itself | Opened session 2026-07-17 |
| **Personal Baseline™ primitive** | Cybersecurity + counsel (ruling ④) | Nothing pre-launch — post-launch by design | Locked in PR #263 (unmerged) |
| **§62 Q5** — competitor-failure scenario physiology | performance-scientist + outside counsel | §62 M7 build (post-launch); does not block launch | Standing, no expiry |
| **PR #28** — §64 voice-wiring | **RESOLVED 2026-07-18** | — | **Closed as superseded** — the merged §64 Steps 1–4 implement conversational-intelligence-in-voice via `useProactiveCoach` + `voiceService`, and #28's shared files had diverged 5 commits behind. Branch preserved/reopenable |
| **App-wide proactive coaching** (product question, salvaged from #28) | Product + performance-scientist | Nothing pre-launch — §64 is dark/gated regardless | The merged §64 mounts the proactive coach in the **voice overlay only**; #28 had an app-wide `_layout` mount. If we want the coach to trigger app-wide (not just when voice is opened), build it clean on the current §64 — do not resurrect #28. Post-launch enhancement |

---

## 5. Human action items — called out first, exact dashboard/action

These do not self-surface. Listed first per standing scrum-master discipline.

1. **Book the regulatory specialist for CR-1.** No reviewer is scheduled. This is the
   critical-path blocker for launch (§1 above) — every other open gate resolves through it.
   **This is now the sole open human action.**

*Resolved 2026-07-18:* PRs #263–#266 merged · PR #28 closed as superseded · Joseph's email
descoped (unrelated to AForce OS).

---

## 6. Production flag inventory — built but OFF in `DEFAULT_FLAGS`

Source: `artifacts/aforce-os/featureFlags/flags.ts` (verified 2026-07-18).

| Flag | Feature | Why it's off |
|---|---|---|
| `spec_commandConfidenceDisplay` | §58 Command Confidence badge | Awaiting internal-preview sign-off |
| `spec_recovery` | Recovery Layer engine | Phase 2 in spec; no visible surface yet |
| `spec_demand_engine` | Hydration Demand Engine | Build 100 / show 0 — no consumer |
| `hydro_scan_2_enabled` | HydroScan 2.0 (§32/§33/§34/§29-OCR) | DR-001: post-launch, CR-1-gated per claim |
| `location_intelligence_enabled` | Location Intelligence | Build 100 / show 10 — advisory, no consumer surface |
| `signal_hierarchy_enabled` | Signal Hierarchy | Freshest-wins stays live while off |
| `spec_weekly_report` | Weekly Performance Report | Build 100 / show 10 |
| `scoreFromLedgerHybrid` | Score-from-Ledger Hybrid | Off even in demo — contribution-level parity unproven |
| `evidence_engine_enabled` | Evidence Engine ("Why this command") | Headless, no consumer |
| `command_confidence_adaptive_enabled` | Command Confidence Step 2 (adaptive selection) | Ledger always records; selection influence gated |
| `adaptive_response_enabled` | §59 Adaptive Response | Engine always derives; exposure gated |
| `response_timeline_enabled` | §60 Response Timeline | Also data-gated (60–90 days history) |
| `living_performance_enabled` | §61 Living Performance Model | Engine always derives; exposure gated |
| `conversational_intelligence_enabled` | §64 Conversational Intelligence | **RD-1 pending; gated on CR-1** |
| `performance_memory_execution_enabled` | Performance Memory execution recap | Surface-only, byte-identical when off |
| `performance_memory_governance_enabled` | Performance Memory governance view | Surface-only |
| `performance_identity_enabled` | Performance Identity raw-signal readout | Classifier inert regardless (no archetype logic exists) |
| `spec_section20_calibration` | §20 → Demand snapshot wiring | **Not yet in `DEFAULT_FLAGS`** — ships with PR #265 (unmerged), then flip gated on BLOCK-2 + COND-3 |
| `spec_phantom`, `spec_enterprise`, `spec_language_*` (ar/zh/ja/ko/hi) | Phase 3+/localization | Out of launch scope, later phases |
| `clutch_*`, `guardian_*` (all) | Phase 2/3 Clutch + Guardian | Out of launch scope, later phases |
| `metabolic_readiness_enabled`, `metabolic_glucose_enabled`, `performance_age_enabled` | Athlete tier / Metabolic Readiness | Out of launch scope |
| `healthkit_native_enabled`, `native_tabs_enabled`, `native_screens_enabled` | Native iOS modules | Deliberately OFF — iOS 26 crash isolation (react-native-screens #3940); not launch-scope features, a stability workaround. Re-enable only when upstream fix confirmed |

**Note:** `cruise_mode_enabled` master switch is `true` even in `DEFAULT_FLAGS` (per spec:
ON for internal builds, OFF for the public production binary — verify at build-profile level,
not just this file, before assuming public users see it). All `cruise_*` sub-features are
individually OFF.

---

*Doctrine note: this audit found one item (PR #28) that aged 13 days without appearing on
any tracked list — the exact "falls through the cracks between workstreams" failure mode
this role exists to prevent. Proposed addition to `.claude/agents/scrum-master.md`: cross-
check `gh pr list --state open` against the sprint's stated open-PR list every session,
not just the PRs named in the ask — an open PR nobody mentions is itself a risk-register
entry.*
