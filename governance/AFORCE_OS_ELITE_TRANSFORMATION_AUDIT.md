# AForce OS — Elite Transformation Audit (Phase 0)

**Status:** Draft for founder review · **Type:** Read-only Phase 0 audit
**Verified against:** `main` history @ working commit `52986ece` (2026-08-01); audit branch `docs/phase0-elite-audit`
**Owner / approval required:** Julius Burrell + Brandon Burrell
**Prepared by:** Claude Code, Phase 0 (Prompt 1) — audit and reconciliation only

> **This document changed no product code, configuration, schema, navigation, flags, or
> entitlements.** It is the index and executive layer of the Phase 0 audit suite. Every claim is
> evidence-backed with `path:line` citations or explicitly marked *needs verification*. Merged
> work is treated as **implementation evidence, not automatically approved product truth**
> (founder instruction, 2026-08-01).

---

## 0. How to read this suite

This audit is delivered as fourteen documents. This file is the executive index; the others hold
the detailed matrices and registers.

| # | Document | Purpose |
|---|---|---|
| 1 | `AFORCE_OS_ELITE_TRANSFORMATION_AUDIT.md` (this file) | Discovery, authority order, methodology, executive findings, doc mapping |
| 2 | `AFORCE_OS_RECONCILIATION_REGISTER.md` | Source-conflict register (extends `SPECIFICATION-RECONCILIATION-REGISTER.md`) |
| 3 | `AFORCE_OS_STOP_SHIP_REGISTER.md` | Defects that must be resolved or accepted before public launch |
| 4 | `AFORCE_OS_CAPABILITY_STATUS_MATRIX.md` | One evidence-backed status per major capability (extends `CAPABILITY-STATUS-REGISTER.md`) |
| 5 | `AFORCE_OS_ELITE_IMPLEMENTATION_PLAN.md` | Dependency-ordered, narrow, reviewable phases |
| 6 | `AFORCE_OS_SCREEN_ACCEPTANCE_MATRIX.md` | Per-route state + acceptance coverage |
| 7 | `AFORCE_OS_MOTION_SPEC.md` | Motion timing classes, reduced-motion, haptics |
| 8 | `AFORCE_OS_AI_VOICE_SPEC.md` | Coach personas, command language, §64 guardrails, Force Mode |
| 9 | `AFORCE_OS_HEALTH_SOURCE_MATRIX.md` | Provider adapter + capability matrix |
| 10 | `AFORCE_OS_ACTIVITY_SPORT_MATRIX.md` | ActivitySession lifecycle + sport registry |
| 11 | `AFORCE_OS_ENTERPRISE_ENTITLEMENT_MATRIX.md` | Clutch / Guardian / Cruise / Founder entitlement + isolation |
| 12 | `AFORCE_OS_SECURITY_PRIVACY_THREAT_MODEL.md` | Auth, tokens, consent, deletion, threat model |
| 13 | `AFORCE_OS_ACCESSIBILITY_REPORT.md` | WCAG, dynamic type, reduced motion, targets |
| 14 | `AFORCE_OS_RELEASE_READINESS.md` | Phase-0 addendum to `Launch-Readiness.md` |
| 15 | `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md` | Night Out Protocol reconciliation (2026-08-01 addendum; Authority + Event-Class-Provider + Entitlement matrices) |

---

## 1. Authority order used for this audit

Per `governance/SPECIFICATION-AUTHORITY.md` §1 (unchanged, reproduced for convenience):

1. `governance/AForce-Constitution.md` (Tier 0 — frozen)
2. `governance/decisions/DR-*.md` + founder decision records (Tier 1)
3. `governance/Claude-Code-Build-Rules.md`, `governance/Architecture-Appendix.md` (Tier 2)
4. `governance/*.md` registers — Terminology, Capability Status, Reconciliation, Risks, etc. (Tier 3)
5. `docs/*-SPEC.md` canonical spec set (Tier 4)
6. `replit.md`, `AFORCE_FINAL_SPEC.md`, legacy specs (Tier 5 — historical)
7. **Current code + tests — implementation evidence, NOT product truth on conflict** (per this audit's founder instruction and `CAPABILITY-STATUS-REGISTER.md` §4: "Documentation is not evidence of implementation… A hidden backend is not evidence of a live capability.")
8. Current screens / galleries — visual evidence
9. Older prompts, mockups, conversations — lowest-authority context

**Governance location:** `/governance/` is the sole authoritative location (Founder Decision 3).
`artifacts/aforce-os/governance/` is a pointer README, **not** an authoritative copy — during this
audit it was found to carry at least one stale value (see Reconciliation Register). These 14
documents are therefore written into `/governance/`.

---

## 2. Discovered governing sources (exact paths, read for this audit)

| Governing source | Path | Read | Notes |
|---|---|---|---|
| Constitution v1.0 (frozen) | `governance/AForce-Constitution.md` | ✅ full | Principle 2 (one hero: HydroState); Principle 5 (observation never diagnosis); "Founding 200" at `:73,:91` |
| Build contract | `governance/Claude-Code-Build-Rules.md` | ✅ full | No new tabs/redesign (#14); thresholds in `config/hydroStateModel.ts` (#13); §62 Founder Mode never in Production (#9) |
| Phase Roadmap | `governance/Phase-Roadmap.md` | ✅ full | Phase 1 named "Founding 200 (Free)" at `:11` |
| Architecture Appendix | `governance/Architecture-Appendix.md` | referenced | Per-section status tags |
| Specification Authority | `governance/SPECIFICATION-AUTHORITY.md` | ✅ full | Tier table above |
| Terminology Registry | `governance/TERMINOLOGY-REGISTRY.md` | ✅ full | §6 two-band systems deliberately separate; §7 banned vocabulary |
| Capability Status Register | `governance/CAPABILITY-STATUS-REGISTER.md` | ✅ full | 8-label status vocabulary (adopted verbatim here) |
| Spec Reconciliation Register | `governance/SPECIFICATION-RECONCILIATION-REGISTER.md` | ✅ full | RC-L1…L15 rulings — this audit extends, does not duplicate |
| Decisions Required | `governance/DECISION-REQUIRED.md` | ✅ full | "Open: None" as of Phase 3.7; DR summary |
| Open Risks (Intelligence) | `governance/OPEN-RISKS.md` | ✅ full | R-01/02/03 S1 launch-blocking; R-12 plaintext cache |
| Launch Readiness | `governance/Launch-Readiness.md` | ✅ full | Verified against `main@7d40b4d7` 2026-07-31; top-6 blockers |
| Continuity | `CONTINUITY.md` | ✅ full | Resume point; later Lock modes (REDTEAM/SECURITY/PRIVACY/GLOBAL/ACCESSIBILITY/PERFORMANCE/TEST/SHIPGATE) NOT run |
| DR-001…DR-009 | `governance/decisions/DR-00*.md` | referenced | DR-001 HydroScan advisory-only; DR-002 server-authoritative + encrypted cache; D-06 Guardian no injury claims |
| Compliance framework | `docs/COMPLIANCE_FRAMEWORK.md` (+ app mirror) | referenced | Sanctioned duplicate; must stay byte-identical |
| Canonical spec set | `docs/AFORCE-OS-MASTER-SPEC.md`, `docs/HYDROSTATE-SPEC.md`, `docs/COMMERCE-AND-ENTERPRISE-SPEC.md`, etc. | referenced | Tier 4 |

---

## 3. Methodology

- **Read-only.** No product code, scoring, schema, UI, navigation, flags, entitlements, or config
  changed. No packages added. No credentials used. No providers connected. Dirty-worktree files
  preserved and excluded from the commit.
- **Evidence discipline.** Each finding cites `path:line`. Where a claim could not be verified from
  static evidence in this environment (e.g. runtime behavior, production build-profile behavior, DB
  state requiring `DATABASE_URL`), it is marked **needs verification** and never asserted as fact.
- **Parallel domain sweep.** Nine domain lenses (routes; HydroState/persistence; command/coach/voice;
  hydration/activity; visual-intelligence/orchestration; commerce; enterprise/Circle;
  security/a11y/tests; plus the Sweat Calculator) were audited read-only and reconciled here.
- **Truth lock.** Capability statuses use the 8-label vocabulary from `CAPABILITY-STATUS-REGISTER.md`
  §1. "Live/Validated" is never claimed without code + config + flag + tests + current visibility.

---

## 4. Executive findings

### 4.1 What is genuinely strong (evidence-backed)
- **Single hero metric holds.** No competing hero score (no strain/recovery-%/DNA-score/hydration-%
  hero) exists in code. HydroState is the one engine score (`utils/scoringEngine.ts`,
  `SPECIFICATION-RECONCILIATION-REGISTER.md` T-6).
- **Commerce money path is disciplined.** Pricing centralized + client/server parity-tested; Command
  `$20/mo · $200/yr` consistent; server-authoritative pricing; **commerce provably cannot mutate
  HydroState** (grep-clean). See doc 11 + Phase 0K evidence.
- **Score Protection is observationally clean at the app layer.** No scan/recommendation/purchase/
  step/view/tap path mutates score; non-intake events are explicitly OBSERVATIONAL
  (`store/app/actions.ts:250,286-291`; `config/hydroStateModel.ts:245,269,283`).
- **Offline durability + idempotency built** (`services/intakeOutbox.ts`, server `clientEventId`
  dedupe + `FOR UPDATE` lock). Reinstall does not reset the user (server-held state reconciles).
- **Dev harnesses correctly gated** — galleries, motion-demo, ui-gallery, phantom/ring behind
  `__DEV__`/`DEMO_MODE`/flag redirects.

### 4.2 Highest-priority concerns (verify before launch)
1. **Client "Developer"/flag-admin tab appears in production (`ProfileScreenV2` `PROFILE_TABS`
   includes `developer` unconditionally).** If reachable in a `DEFAULT_FLAGS` production build, any
   signed-in user could flip Clutch/Guardian/Phantom flags client-side — contradicting Build-Rule #9
   / §62 ("Founder Mode never in Production"). **Needs build-profile verification** (may be neutered
   by server entitlement + DEMO-only flag lighting). Stop-ship candidate S1. (Phase 0A)
2. **Three band systems disagree at scores 85–89** — 4-state (90/75/60) vs two 5-band systems
   (85/70/50/30) with *different labels* (`statusColor` OPTIMAL/… vs `commandVoice` PEAK/STABLE/
   CORRECT/…). At 85–89 the orb says BALANCED, the voice says PEAK/"elite", the color says OPTIMAL.
   The 4-vs-5 split is governed and intentional (Terminology §6 / RC-L2); the **threshold + label
   divergence across surfaces is a real coherence defect.** Stop-ship candidate (moderate). (Phase 0B)
3. **"Readiness" is overloaded** — it is both the user-facing HydroState hero label
   (`index.tsx:250`, `_layout.tsx:208`) and the name of a separate biometrics-fed Metabolic Readiness
   feature (`types/index.ts:898`, `metabolic_readiness_enabled`). Naming collision risks "is my
   Readiness the score or the wearable number?" Stop-ship candidate (naming). (Phase 0B)
4. **Score Protection is not enforced in production** — server guard exists
   (`api-server/src/lib/scoreWriteGuard.ts`) but runs shadow-only; `off` in prod until Phase 3B.
   Confirms RC-L8b / N-5 / R-29. Capability = Built-Hidden, not Live. (Phase 0B)
5. **Consumption state machine largely absent** — a single tap credits HydroState immediately; the
   SCANNED→…→DISCARDED lifecycle is not implemented (RC-L12; Phase 0D — pending). Scanning/selecting
   must never equal consumption.

### 4.3 Governed non-defects (do not "fix")
- **4-band vs 5-band ladders** — deliberate and reconciled (Terminology §6, RC-L2). Do not merge.
- **DEPLETED `#FF2800` vs brand Signal Red `#C1281B`** — the distinction is intentional and enforced
  (`homePresentation.ts:12-13`); no red-for-positive found. Not a defect.
- **11 oz vs 12 oz** — founder ruled keep 12 oz (RC-L3); code is 12 oz. Only the hero *artwork*
  reads 11 FL OZ (RC-L3 addendum, minor open label item).
- **Non-English locales are English placeholders** — deliberate (`fallbackLng:'en'`, R-24); only
  English is §42-validated for intelligence claims.

### 4.4 Stop-ship item #3 (Sweat Calculator) — disposition: NOT reproduced
The prompt's example (170 → 167.5 lb, 16 fl oz, 60 min) computes correctly in current source:
`sweatLoss = (1.134 kg) + (0.473 L) = 1.607 L/h → ×33.814 = 54.3 oz/h`
(`services/sweatRateEngine.ts:229-235,522`). The ACSM formula is implemented verbatim and returns a
physically plausible ~54 oz/h, **not ~600**. The screen displays `1.61 L/h`
(`screens/SweatCalculatorScreen.tsx:770`). **Residual gaps:** (a) **zero automated sweat tests** lock
the formula/units/boundaries — the prompt explicitly requires this coverage; (b) the screen surfaces
only L/h, not the app-canonical oz. Kept in the Stop-Ship Register as *proven-correct + coverage gap*.

---

## 5. Document mapping (avoid duplicate sources of truth)

| This suite | Relationship to existing approved docs |
|---|---|
| `…RECONCILIATION_REGISTER.md` | **Extends** `SPECIFICATION-RECONCILIATION-REGISTER.md` (canonical). New OS-audit conflicts get `PA-*` ids; existing `RC-L*` items are referenced, not restated. |
| `…CAPABILITY_STATUS_MATRIX.md` | **Extends** `CAPABILITY-STATUS-REGISTER.md` (canonical for Intelligence §38–42/§61). New file covers OS routes/features/providers/commerce/enterprise and defers Intelligence rows to the register. |
| `…STOP_SHIP_REGISTER.md` | New; cross-links `OPEN-RISKS.md`, `Risk-Register.md`, `Launch-Readiness.md` §1. |
| `…RELEASE_READINESS.md` | **Thin addendum** to `Launch-Readiness.md` (canonical); does not restate its tables. |
| `…IMPLEMENTATION_PLAN.md` | Sequences the above; references `Phase-Roadmap.md`, `PASS3-BUILD-PLAN.md`, `LOCK-BUILD-PLAN.md`. |
| `…HEALTH_SOURCE_MATRIX.md` | References `docs/HEALTH_PLATFORM_INTEGRATION_ARCHITECTURE.md`. |
| `…AI_VOICE_SPEC.md` | References `Section-63-Compliance-Pass.md`, §64, `CLAIMS-REGISTER.md`. |
| `…ENTERPRISE_ENTITLEMENT_MATRIX.md` | References `docs/COMMERCE-AND-ENTERPRISE-SPEC.md`, `Section-62-Founder-Mode-Spec.md`. |
| `…SECURITY_PRIVACY_THREAT_MODEL.md` | References `DATA-CLASSIFICATION-MATRIX.md`, DR-004/DR-005. |
| `…MOTION_SPEC.md`, `…ACTIVITY_SPORT_MATRIX.md`, `…SCREEN_ACCEPTANCE_MATRIX.md`, `…ACCESSIBILITY_REPORT.md` | New; no prior standalone equivalent. |

---

## 6. Stop condition

Phase 0 ends here: documentation only, committed, then **stop for Julius + Brandon approval**. No
screen redesigned, no component created, no defect repaired, no implementation phase begun. The
recommended first implementation phase is stated in `AFORCE_OS_ELITE_IMPLEMENTATION_PLAN.md` for
founder approval — it is a proposal, not an authorization.
