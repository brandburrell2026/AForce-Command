# Decisions Required

**Status:** Canonical · **Updated:** 2026-07-22 (Phase 3 authorization)

Open questions that **cannot** be resolved from existing authority. Per
`SPECIFICATION-AUTHORITY.md` §2, a build agent encountering one must stop rather than choose.

**[JB]** = requires both Julius and Brandon.

---

## Open

**None.** All decisions raised through Phase 3.7 are closed.

---

## Resolved

| ID | Question | Resolution |
|---|---|---|
| D-R1 | May new branded systems be added despite the V1 lock? | **Founder Decision 1** — yes, four named systems, under seven constraints |
| D-R2 | AForce Intelligence™ vs Meridian™ | **Founder Decision 2** — umbrella vs. Phase 3 tier |
| D-R3 | Governance single source | **Founder Decision 3** — `/governance/` sole authority; mirror → pointer |
| D-R4 | Does Performance DNA™ emit a score? | **Founder Decision 4** — never; qualitative patterns only |
| D-R5 | Section allocation | **Founder Decision 5** — §38–42, §43–46 reserved, LPM stays §61 |
| D-R6 | Was unique content lost in the mirror? | **No** — full diff showed one mirror-only line, the superseded status text |
| **D-07** | Is Performance Drift™ (§27) a member of AForce Intelligence™? | ✅ **CLOSED 2026-07-22.** Yes — **Context Intelligence**. Taxonomy 17 → **18 members**. Never issues commands, never creates a competing score, never bypasses Core. |
| **D-08** | HydroState model version | ✅ **CLOSED 2026-07-22 — `DR-009` Option A. IMPLEMENTED IN SOURCE, NOT DEPLOYED.** `hydrostate-v0` in `config/hydroStateModel.ts`; nullable `hydrostate_model_version` column; central `scoreSnapshotRepo.ts`. |
| **D-09** | Authoritative version source + central write path | ✅ **CLOSED 2026-07-22.** (1) constant in `config/hydroStateModel.ts`, format `hydrostate-v<major>.<minor>` · (2) first version **`hydrostate-v0`** (Option C, pre-governance) · (3) Founder + Engineering approval, Scientific when physiological · (4) `scoreSnapshotRepo.ts` approved · (5) **duplicated stamping REJECTED**. |
| D-R7 | Canonical name for §59 | ✅ **Adaptive Response Engine™** canonical in all structural contexts; **Adaptive Response™** approved prose shorthand. §59 unchanged. |
| **D-01** | Reserved sections §43–46 | ✅ **CLOSED — `DR-003`.** Stay reserved. No pre-assignment, no new branded systems. |
| **D-02** | §38 persistence: device-only or server-synced? | ✅ **CLOSED — `DR-002`.** **Server-synced; PostgreSQL authoritative.** Limited encrypted, non-authoritative local cache. Deletion propagates; no unrestricted retention. |
| **D-03** | §39 data-sufficiency threshold | ✅ **CLOSED — `DR-003`.** 7 days / 5 comparable observations / 3 distinct days / fresh context / sufficient signal quality / confidence floor. Configurable beta defaults. Four output states required. |
| **D-04** | Earliest §40 surface phase | ✅ **CLOSED — `DR-003`.** Five-step sequence: Founder Mode → Weekly Report beta → Your Body's Manual → AI Coach → flagged Home card. **Never in onboarding.** |
| **D-05** | Legacy document disposition | ✅ **CLOSED — `DR-003`.** Banners retained; no de-duplication during this sequence. Deferred maintenance. |
| **D-06** | Guardian "injury-risk protection" | ✅ **CLOSED — `DR-003`.** Removed. Canonical: **"Performance readiness and recovery oversight."** Guardian claims no injury prediction, prevention, diagnosis, or medical-risk assessment. |
