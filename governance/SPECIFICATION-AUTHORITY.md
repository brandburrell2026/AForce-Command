# Specification Authority

**Status:** Canonical · **Established:** 2026-07-22 (Phase 2, Founder Decisions 1–5)
**Owners:** Julius Burrell, Brandon Burrell

Defines which document wins when two documents disagree. Read this before treating any
specification statement as binding.

---

## 1. Authority hierarchy

Higher tier always wins. A lower-tier document that contradicts a higher tier is **defective**,
not an alternative reading.

| Tier | Document(s) | Authority |
|---|---|---|
| **0** | `governance/AForce-Constitution.md` | Absolute. Frozen. Changeable only under its own Change Control (documented proposal + beta evidence + Julius **and** Brandon + version bump). |
| **1** | `governance/decisions/DR-*.md`, founder decision records | Settled rulings. Amend lower tiers on contact. |
| **2** | `governance/Claude-Code-Build-Rules.md`, `governance/Architecture-Appendix.md` | The build contract and per-section status. |
| **3** | `governance/*.md` registers (this file, Terminology, Phase Matrix, Claims, Data Classification, Risks, Dependency Map, Model Versions, Validation Matrix) | Canonical for their subject. |
| **4** | `docs/AFORCE-OS-MASTER-SPEC.md` and the canonical `docs/*-SPEC.md` set | Canonical product/technical specification. |
| **5** | `docs/AFORCE_OS_ARCHITECTURE_V1.md`, `AFORCE_FINAL_SPEC.md`, `AFORCE_PHASE_STATUS.md`, `replit.md`, `SPEC-SHEET.md`, `artifacts/aforce-os/docs/AForce-OS-Specification.md` | **Legacy / historical.** Retained for history. Superseded where they conflict with tiers 0–4. |

**Single source rule:** `/governance/` is the sole authoritative governance location
(Founder Decision 3). No other directory holds an authoritative governance copy.

## 2. Resolution procedure

1. Identify the tier of each conflicting statement.
2. The higher tier controls. If both sit at the same tier, the one with the later decision
   record controls.
3. Record the conflict and its resolution in `SPECIFICATION-RECONCILIATION-REGISTER.md`.
4. If neither can be resolved from existing authority, add it to `DECISION-REQUIRED.md` and
   **stop** — do not resolve a governance ambiguity by choosing.

## 3. Permitted duplication

Duplication is a drift risk (audit finding A6). Only these copies are sanctioned, and each is
covered by the drift check in `scripts/src/check-governance-drift.mjs`:

| Canonical | Sanctioned copy | Reason |
|---|---|---|
| `docs/COMPLIANCE_FRAMEWORK.md` | `artifacts/aforce-os/legal/COMPLIANCE_FRAMEWORK.md` | In-app legal surface must ship inside the bundle. Must stay byte-identical. |

`artifacts/aforce-os/governance/` is **no longer a copy**. It is a pointer README
(Founder Decision 3).

## 4. Trademark and terminology authority

`governance/TERMINOLOGY-REGISTRY.md` is canonical for every ™ term, its definition, and its
approved aliases. A term used outside its registry definition is a defect.

## 5. Claims authority

Any user-facing statement asserting a physiological, performance, or predictive effect must
appear in `governance/CLAIMS-REGISTER.md` with an approved phrasing before it ships.
