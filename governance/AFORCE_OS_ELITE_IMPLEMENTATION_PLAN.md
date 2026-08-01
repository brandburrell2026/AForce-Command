# AForce OS — Elite Implementation Plan (Phase 0 proposal)

**Status:** Proposal for founder approval — **NOT an authorization to build** · Read-only Phase 0
**Owner / approval:** Julius + Brandon · **Verified against:** `52986ece` (2026-08-01)
**References:** `Phase-Roadmap.md`, `PASS3-BUILD-PLAN.md`, `LOCK-BUILD-PLAN.md`, `Launch-Readiness.md`.

> A capability appearing in this plan is **not** implemented. Each phase is narrow, reviewable, and
> gated. No phase begins without explicit founder approval. Off-limits files (`scoringEngine.ts`,
> `statusColor.ts`, `config/hydroStateModel.ts` thresholds) are never edited without the DR process.
> Every behavioral change is flag-gated and additive; navigation stays at five tabs (Build-Rule #14).

---

## 0. Classification of all Phase-0 findings

| Class | Meaning | Items |
|---|---|---|
| **A · Stop-ship correction** | Must resolve/accept before public launch | SS-01…SS-25 (see Stop-Ship Register) |
| **B · Existing-feature completion** | Shipped surface, incomplete to standard | Command Standard (#11/#13), consumption ladder, Hydration deep-model surfacing, dynamic-type, reduced-motion coverage |
| **C · Existing hidden-feature preparation** | Built-Hidden; prep before reveal | Score-Protection enforce (3B), Smart Capture privacy, Guardian/Clutch DR-006 copy, provider Phase-C encryption |
| **D · Future flagged architecture** | Designed/specified, not built | Canonical event ledger, ActivitySession lifecycle, Founder Mode §62, Cruise Industry B2B, server enterprise RBAC, §39 Prediction (register-gated) |
| **E · Out of scope (this program)** | Deliberately deferred | §64 enable (RD-1/CR-1), §20 calibration (BLOCK-2/COND-3), Personal Baseline, iOS direct checkout |

---

## 1. Dependency-ordered phases (proposal)

### Phase P1 — Production-safety hardening (Class A · S1) — **do first, blocks launch**
Dependency root; small, high-severity, mostly gating/config.
1. **SS-01** — gate the client Developer/flag-admin tab behind `__DEV__`/server role; confirm no
   `DEFAULT_FLAGS` prod build exposes it. (config/gate; no scoring touch.)
2. **SS-05** — complete the BAC/impairment/driving deprecation: remove `socialModeEngine` call sites,
   delete orphaned components, strip locale keys across 12 files. (counsel sign-off.)
3. **SS-04** — scope + design GDPR/CCPA export + deletion (counsel-gated; may be Class D build).
4. **SS-03** — confirm provider-token encryption keys set in prod; schedule Phase-C column drop.
- **Gate:** counsel + founder sign-off. **Touches:** no off-limits files.

### Phase P2 — Trust & clarity coherence (Class A · S2)
Depends on P1 sign-off cadence, independent code-wise.
1. **SS-11 / PA-03** — centralize band cutoffs into one config surface; reconcile the three label
   sets; register voice band names in Terminology §6. (No band-math change; presentation + naming.)
2. **SS-12 / PA-04** — rename the HydroState hero label away from "Readiness"; disambiguate Metabolic
   Readiness in Terminology. (Copy + i18n.)
3. **SS-06 / SS-07 / SS-08** — private-by-default sharing; consent-gate/scope the global leaderboard;
   add moderation/report/block + minor gate. (Privacy defaults + new UI.)
4. **SS-13 / PA-07 · SS-14** — reconcile AForce sodium value; extend compliance test guard to
   `flavors.ts`/`pricing.ts`/comparison engine; verify no detox/cellular/alkaline copy reaches render.

### Phase P3 — Command & consumption completion (Class B)
1. **SS-22** — add verification-method (#11) + safe-alternative (#13) to the command object; surface
   confidence/source/adjust/decline/partial on the Home command card (parity with RecoveryCoach).
2. **SS-23 / RC-L12** — minimal honest consumption ladder (logged → verified); require amount
   confirmation on the two scan-log paths (`realApi.ts:337`).
3. **SS-17** — Force Mode: decide opt-in default; add quiet hours + OS-DnD respect for TTS.
- **Gate:** performance-scientist review of command copy.

### Phase P4 — Enterprise & camera preparation (Class C, gated)
1. **SS-02** — server-side entitlement/RBAC before any Clutch/Guardian/Cruise-Industry enable.
2. **SS-09 / PA-06** — Guardian/Clutch DR-006 governed language + disclaimer.
3. **SS-10** — Smart Capture: explicit consent, raw-image minimization/deletion, correct
   on-device/server disclosure before `hydro_scan_2_enabled`.

### Phase P5 — Coherence cleanup (Class A · S3 + Class B quality)
1. **SS-18** — per-screen error boundaries on Profile/Leaderboard (durable fix over babel workaround).
2. **SS-19 / SS-20** — gate/relabel `modules.tsx`; retire `social-legacy`/`social-v2` duplicates.
3. **SS-24** — fix stick-allotment `unitsPerCycle`.
4. **Dynamic-type + reduced-motion coverage** — adopt a font-scale clamp on large numerics; extend
   reduced-motion to the ~30 animated files that don't consult the hook. (Note: an unmerged branch
   already prototypes the clamp + a11y screen — evaluate for adoption.)
5. **Token drift** — bounded sweep of raw-hex → `af.*` tokens (honest scope, not unbounded).

### Phase P6 — Future flagged architecture (Class D — design first, build on approval)
- Canonical event ledger wiring (schemas exist); ActivitySession lifecycle; Cruise Industry B2B;
  Founder Mode §62 (server-auth, Production-hidden, Sandbox-only). Each is a separate spec → build.

### Out of scope (Class E)
§64 enable (CR-1/RD-1), §20 calibration, Personal Baseline, iOS direct checkout — tracked in
`Launch-Readiness.md`; not part of this program.

---

## 2. Guardrails for every phase
- Flag-gated, additive, presentation-first; no navigation change; five tabs preserved.
- No edit to `scoringEngine.ts` / `statusColor.ts` / `config/hydroStateModel.ts` thresholds without DR.
- Each phase = its own reviewable PR set with tests (esp. the coverage gaps: sweat units, render/a11y,
  entitlement). `tsc` clean + full-suite regression per PR.
- Truth discipline: no capability described as built until it has code + flag + tests + visibility.

---

## 3. Recommended first phase (for founder decision)

**Phase P1 (production-safety hardening).** It is the dependency root, contains all five S1 items, is
mostly gating/config/counsel rather than deep code, and touches no off-limits files. **This is a
recommendation, not an authorization** — begin only on explicit Julius + Brandon approval.
