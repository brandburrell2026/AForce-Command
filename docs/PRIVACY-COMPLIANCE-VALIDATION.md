# Privacy, Compliance & Validation

**Status:** Canonical (tier 4) · **Updated:** 2026-07-22
**Governing document:** `docs/COMPLIANCE_FRAMEWORK.md` (unchanged by Phase 2)

How AForce Intelligence™ satisfies the privacy, compliance, and validation posture — and where it
does not yet.

---

## 1. Compliance inheritance

Every module inherits the compliance framework **by default the moment it is created**. The four
systems authorized under Founder Decision 1 inherit it automatically:

| System | Primary obligations |
|---|---|
| §38 Performance Knowledge Graph™ | §5 Privacy by Design · §6 Data Collection & Retention |
| §39 Prediction Engine™ | **§2 Observation Never Diagnosis** · §4 Evidence · §14 Health Disclaimer · §17 AI Disclosure |
| §40 Performance DNA™ | **§2 Observation Never Diagnosis** · §4 Evidence · §17 AI Disclosure |
| §41 Provenance & Retention | §5 Privacy by Design · §6 Retention · §8 User Permissions |
| §42 Language & Compliance Gate | §2 · §3 AI Transparency · §14 · §17 |
| §61 Living Performance Model™ | §2 · §4 Evidence |

## 2. Privacy posture

### 2.1 No new collection

**§38–42 introduce no new raw data collection.** Every class they touch is derived from data
already collected under existing consent (`governance/DATA-CLASSIFICATION-MATRIX.md` §3). This is
a deliberate design constraint: the intelligence layer deepens without widening the privacy
surface.

### 2.2 Principle 7 answered before ship

*Who sees this data, and why, must be answered before any feature ships.*

| Actor | Access |
|---|---|
| The user | Full — own data, patterns, provenance, with challenge and dismissal controls |
| AI Coach | Read-only at inference time (§64) |
| Founder Mode | **Sandbox only**; writes never reach Production (§62) |
| Demo Mode | Seeded demo data only; writes nothing |
| Third parties | **None.** Never sold, never shared, never used for advertising. |

### 2.3 Retention

Derived data is **subordinate** to its sources. Deleting source events invalidates every edge,
pattern, and projection built from them. A pattern whose evidence was deleted is **retired**, not
preserved. Projections expire and are never re-surfaced stale.

Export and deletion route through the existing Privacy Center (§51) contract.

### 2.4 Sensitive classes

Camera imagery (HydroScan, skin) and health-app data are class **S3** — explicit per-feature
consent, strictest retention, and **never used for advertising**. HydroScan remains advisory-only
and never mutates score (DR-001).

## 3. Compliance posture

### 3.1 Observation, never diagnosis

The single most important compliance property of this layer. Enforced by:

1. **Banned vocabulary**, absolute — `governance/CLAIMS-REGISTER.md` §1.
2. **The §42 gate**, fail-closed, covering visual and voice output.
3. **A mechanical test** asserting no banned term can reach any emitted copy key in any locale.
4. **Claim classes** — C5 (population) and C6 (medical) are prohibited outright.

**This is enforced by tests, not by editorial discipline.** A surface without the §42 test is not
shippable.

### 3.2 Evidence and explainability

No claim reaches a user without an Evidence Engine™ route (Founder Decision 1). §41 provenance
makes Principle 3 mechanically enforceable: every claim resolves to real source events plus the
model version that read them.

### 3.3 AI disclosure

Per COMPLIANCE_FRAMEWORK §3 and §17, wherever generated language appears — including voice.

### 3.4 Physician routing

Recurring or severe symptoms always prompt physician consultation. Inherited from §59 and
preserved through §42 (`INTELLIGENCE-VALIDATION-MATRIX.md` L-3).

### 3.5 Feature-flag policy

Every new system ships dark. Built ≠ exposed. Founder Decision 1 is explicit: no system may be
exposed publicly merely because its backend exists.

## 4. Validation posture

`governance/INTELLIGENCE-VALIDATION-MATRIX.md` defines eight universal checks (V-1…V-8) plus
per-system checks. A system may not surface until its row is green **and** the five phase-gate
conditions in `FEATURE-PHASE-MATRIX.md` §5 are met.

**Current state: nothing is validated.** No implementation exists.

### 4.1 Beta validation

Per COMPLIANCE_FRAMEWORK §11 and the Constitution's Learning Journal Protocol: Founding 250
feedback goes to `Learning-Journal.md` first. Nothing from a single tester graduates directly into
the Constitution or the Architecture Appendix — only a pattern across multiple users, approved by
Julius and Brandon.

## 5. Open gaps

| Gap | Tracking |
|---|---|
| ~~§38 persistence location undecided~~ | ✅ **CLOSED — `DR-002`.** Server-authoritative PostgreSQL + limited encrypted non-authoritative device cache. |
| ~~Guardian "injury-risk protection"~~ | ✅ **CLOSED — `DR-003`.** Canonical: "Performance readiness and recovery oversight." |
| **Device cache is plaintext today** — `DR-002` requires encryption | `OPEN-RISKS.md` **R-12** (S1) · Phase 3 output C/F |
| **No account-wide deletion endpoint exists** — only `POST /analytics/forget` (pseudonymous). The `DR-002` propagation needs a broader path. | Phase 3 output F |
| **Retention rules per data class not yet written** — `DR-002` forbids unrestricted permanent retention | Phase 3 output F |
| **Pre-launch claims review (CR-1) must explicitly cover §39** | `Risk-Register.md` CR-1 · `OPEN-RISKS.md` R-01 |
| **Number/date localization** is device-locale bound | Known gap, pre-existing |
| **Model version registry is empty** — populated at first implementation | `MODEL-VERSION-REGISTRY.md` |
