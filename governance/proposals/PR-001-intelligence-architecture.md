# PR-001 — AForce Intelligence™ Architecture: Audit, Reconciliation, Specification & Implementation Design

- **Status:** ✅ **ACCEPTED — Phase 1 audit approved; Founder Decisions 1–5 recorded 2026-07-22.**
  Phase 2 (canonical specification reorganization) is **complete**. **No application code has been
  written; no migrations, no flags, no surfaces.** Phase 3 implementation design awaits approval.
- **Date:** 2026-07-22 · **Accepted:** 2026-07-22
- **Author:** Claude Code (build agent)
- **Deciders:** Brandon (founder), Julius — both required for items marked **[JB]**

> ## Disposition of Part 5 (approval gate)
>
> | Gate item | Outcome |
> |---|---|
> | Decision 1 — amend the V1 lock | ✅ **APPROVED.** Four systems authorized under seven binding constraints. |
> | Decision 2 — AForce Intelligence™ / Meridian™ | ✅ **APPROVED.** Umbrella vs. Phase 3 tier. Fourteen coordinated members named. |
> | Decision 3 — §38–42 allocation | ✅ **APPROVED** as **Founder Decision 5**, with §41 widened to include Model Versioning and §42 renamed to the Intelligence Language and Compliance Gate. |
> | Decision 4 — mirror repair | ✅ **APPROVED** — delete-and-pointer, after unique-content preservation. Executed. |
> | Decision 5 — Performance DNA™ emits traits, never a score | ✅ **APPROVED** and **expanded** into Founder Decision 4: five named pattern states and eight mandatory fields per pattern. |
> | Decision 6 — §39 blocked until §42 accepted | ✅ **APPROVED.** |
> | Open question — phase placement | ✅ Resolved in `governance/FEATURE-PHASE-MATRIX.md`. |
>
> **Where the founder went beyond the proposal:** Decision 4 specified the pattern-state vocabulary
> and the eight mandatory fields (including *contradictory observations* and user challenge/dismissal
> controls) that the proposal had left open. Decision 3 added the preservation-before-removal
> sequence and the CI rule. Both are reflected in the canonical specs.
>
> **Deliverables:** `governance/SPECIFICATION-AUTHORITY.md`, `TERMINOLOGY-REGISTRY.md`,
> `SPECIFICATION-RECONCILIATION-REGISTER.md`, `FEATURE-PHASE-MATRIX.md`, `CLAIMS-REGISTER.md`,
> `DATA-CLASSIFICATION-MATRIX.md`, `OPEN-RISKS.md`, `DECISION-REQUIRED.md`,
> `INTELLIGENCE-DEPENDENCY-MAP.md`, `INTELLIGENCE-MIGRATION-PLAN.md`,
> `INTELLIGENCE-VALIDATION-MATRIX.md`, `MODEL-VERSION-REGISTRY.md`, and the canonical
> `docs/` specification set. Start at `docs/AFORCE-OS-MASTER-SPEC.md`.
>
> **Still open:** D-01…D-06 in `governance/DECISION-REQUIRED.md`. **D-02 (§38 persistence location)
> blocks Phase 3 schema design.** **D-06 (Guardian "injury-risk protection" vs. banned vocabulary)
> was discovered during Phase 2 and is new.**
- **Governs (if accepted):** `governance/Architecture-Appendix.md` (new §38–42, amended §61);
  `docs/AFORCE_OS_ARCHITECTURE_V1.md` (lock clause, Meridian™ role, Master Engine Flow);
  `governance/Phase-Roadmap.md`; `artifacts/aforce-os/utils/intelligence/**`;
  `artifacts/aforce-os/config/hydroStateModel.ts`; `artifacts/aforce-os/featureFlags/flags.ts`
- **Related:** `DR-001` (advisory-only precedent), `AForce-Constitution.md` (Principles 2, 5, 8, 9, 11, 14),
  `Claude-Code-Build-Rules.md` (rules 6, 8, 12, 13, 14), Risk-Register CR-1

> **Reading order:** Part 1 is what the repository actually contains today. Part 2 proposes how
> to resolve the contradictions Part 1 found. Part 3 is the specification that follows from
> Part 2. Part 4 is the implementation design. Part 5 is the approval gate — the decisions that
> must be made before a single line of Track 2 code is written.

---

# PART 1 — AUDIT

Method: full-text sweep of all 28 specification documents and the `artifacts/aforce-os` +
`artifacts/api-server` source trees. Counts are files containing the term, excluding
`node_modules`.

## 1.1 Coverage of the named systems

| System | Spec files | Code files | Assessment |
|---|---|---|---|
| HydroState™ | 28 | 28 | Fully specified, fully built. Hero metric. |
| HydroScan™ | 34 | 80 | Heaviest surface in the repo. Amended by DR-001. |
| Command Confidence™ | 14 | 40 | Built (§58 display + underlying engine). |
| Performance Memory™ | 17 | 35 | Built, incl. `performanceMemoryUnified.ts`. |
| Evidence Engine™ | 12 | 14 | Built; the mandatory explanation path. |
| Today's Command | 8 | 12 | Built. |
| Adaptive Response Engine™ | 5 | 8 | Built (§59). |
| Living Performance Model™ | 6 | 8 | **Partial** — §61 STEP 1 daily lesson only. |
| **AForce Intelligence™** | **2** | **1** | **Not a defined term.** See A1. |
| **Performance Knowledge Graph™** | **0** | **0** | **Does not exist.** |
| **Prediction Engine™** | **0** | **0** | **Does not exist.** |
| **Performance DNA™** | **0** | **0** | **Does not exist.** |

Three of the four Track 2 systems are genuinely net-new — there is no prior art to preserve or
avoid duplicating. The fourth (Living Performance Model™) has a real, tested base at
`utils/intelligence/livingPerformanceModel.ts` (78 lines, headless, Score-Protection tested)
and its remaining modules are already named and phase-tagged in §61. Track 2's "LPM expansion"
is therefore an **extension of an existing section, not a new system**.

## 1.2 Findings

### A1 — "AForce Intelligence™" is not a defined term, and its role is already occupied [BLOCKING]

The phrase appears three times, none of them normative: a code comment in
`utils/confidence/dataConfidence.ts`, and two entries in the agent memory index.

Meanwhile `docs/AFORCE_OS_ARCHITECTURE_V1.md` already assigns the coordinated-intelligence role
to **Meridian™**:

> "Meridian™ is the intelligence layer that consumes the engines, decides, and routes through
> Evidence Engine → Command Confidence → AutoPilot for delivery." (line 37)

Track 1 requires AForce Intelligence™ to *be* the coordinated intelligence architecture. As
written, that collides head-on with Meridian™.

### A2 — Meridian™ is itself overloaded (pre-existing defect, independent of this work)

`Architecture V1` calls Meridian™ an architecture layer. `Phase-Roadmap.md` Phase 3 lists
"**Meridian luxury tier**" — a commercial tier. One trademark is doing two incompatible jobs:
a structural layer that everything routes through, and a paid tier that most users never get.
If Meridian™ is a tier, then routing cannot depend on it; if it is the routing layer, it cannot
be withheld behind a tier. This is a live inconsistency in the shipped spec set.

### A3 — The V1 lock clause forbids exactly what Track 2 asks for [BLOCKING]

`docs/AFORCE_OS_ARCHITECTURE_V1.md` line 3:

> "Version 1 architecture is locked after Sections 53–57. **No new branded systems beyond what
> is specified here.**"

Track 2 introduces four ™ systems. Read literally, Track 2 is prohibited.

**However — this clause has already been superseded once.** Sections 58–64 (Command Confidence
Display, Adaptive Response Engine, Response Timeline, Living Performance Model, Founder Mode,
Compliance Pass, Conversational Intelligence Architecture) were all added *after* the lock, and
`Claude-Code-Build-Rules.md` rule 1 explicitly instructs building them. Several carry ™ marks.
So the operative precedent is not "the architecture never extends" but "**the architecture
extends only by explicit, recorded founder instruction**." That is the instrument Track 2 needs,
and it is what Part 5 requests.

### A4 — Sections 38–46 do not exist anywhere [OPPORTUNITY]

Both the Architecture Appendix and Architecture V1 jump from §37 (Global HydroScan) straight to
§47 (Performance Sharing). A search for `Section 38`…`Section 46` / `§38`…`§46` across every
markdown file returns zero hits. Nine section numbers are unallocated. Nothing depends on them
and nothing references them — this is clean, unclaimed numbering space sitting exactly between
the HydroScan intelligence block and the engagement block.

### A5 — The governance mirror is stale in a way that inverts a controlling rule [DEFECT]

`CLAUDE.md` states governance is "mirrored in `artifacts/aforce-os/governance/`". The mirror is
incomplete and out of date:

| Document | Root | Mirror |
|---|---|---|
| AForce-Constitution.md | ✅ | ✅ identical |
| Claude-Code-Build-Rules.md | ✅ | ✅ identical |
| Phase-Roadmap.md | ✅ | ✅ identical |
| Learning-Journal.md | ✅ | ✅ identical |
| **Architecture-Appendix.md** | ✅ | ⚠️ **stale — 9 lines missing** |
| Launch-Readiness.md | ✅ | ❌ absent |
| Risk-Register.md | ✅ | ❌ absent |
| Section-62-Founder-Mode-Spec.md | ✅ | ❌ absent |
| Section-63-Compliance-Pass.md | ✅ | ❌ absent |

The missing 9 lines are the **DR-001 launch amendment**. The mirror still says §35 is
"Build Now" with no amendment; the root says HydroScan is advisory-only and must never mutate
score. The mirror lives *inside the app source tree* — it is the copy an agent working in
`artifacts/aforce-os` is most likely to open. A build agent reading the mirror would conclude
HydroScan is permitted to write into HydroState, Performance Memory, and Command Confidence.
That is a Score-Protection breach waiting to happen, and it is a defect today, before any
Track 2 work.

### A6 — Specification duplication across four documents [RISK]

The Water-First rule, Score Protection rule, Language lock, and Product Positioning rule are
restated in full in `replit.md`, `artifacts/aforce-os/SPEC-SHEET.md`,
`artifacts/aforce-os/docs/AForce-OS-Specification.md`, and `AFORCE_FINAL_SPEC.md`. Four
independent copies of the same locks, none marked as authoritative over the others. A5 shows
what happens when copies drift.

### A7 — Constitutional constraints binding on all Track 2 work

These are not obstacles to route around; they are the design envelope.

- **Principle 2 — "One hero metric. HydroState. Never create a competing hero metric."**
  Performance DNA™ is the acute risk: a single memorable per-user score would compete with
  HydroState directly.
- **Principle 5 — "Observation, never diagnosis."** Plus §59's non-negotiable language rule:
  never the words *risk, injury, diagnosis, prevent*. **Prediction Engine™ is the highest
  compliance-risk system in this proposal** — a forecast delivered in the wrong register becomes
  a medical claim.
- **Principles 8 & 9 — Build once, reveal over time.** Architecture complete; surfaces flagged.
- **Principle 14 — must prove value after one year of use**, not day one.
- **Score Protection** (`replit.md`, DR-001): only completed behavior modifies score. Everything
  in Track 2 must be advisory-only.
- **Build Rule 13** — every threshold in `config/hydroStateModel.ts`, never hardcoded.
- **Build Rule 14** — no new tabs, no navigation redesign, no rebuild of existing systems.
- **Build Rule 6** — extend existing systems; never build a parallel one.

### A8 — Existing engineering constraints Track 2 must inherit

From `.agents/memory/aforce-intelligence-core.md` (hard-won, documented):

- A shared **command-event ledger** already exists — additive, RN-free, pure, with thin adapters
  onto the pre-existing engines. Track 2 builds **on** this, not beside it.
- Per-source day-index conventions differ (local-calendar vs UTC floor) and must be preserved
  round-trip.
- Persistence must defer writes until after boot-hydration, and `clear()` must bump a generation
  counter — otherwise history is clobbered or resurrected.
- Ledger recorder effects need both a freshest-state existence check and an in-flight latch, or
  they loop forever.

---

# PART 2 — RECONCILIATION

Proposed resolutions. Each is a **proposal**, not an applied change.

### R1 — AForce Intelligence™ becomes the architecture umbrella; Meridian™ becomes solely the commercial tier

Resolves A1 and A2 together.

- **AForce Intelligence™** — the coordinated intelligence architecture. The collective noun for
  every engine that observes, learns, explains, and decides. Architecture-level term.
- **Meridian™** — the Phase 3 premium tier, as `Phase-Roadmap.md` already sells it. A commercial
  package, not a structural layer.
- The routing sentence in Architecture V1 line 37 is rewritten to attribute decide-and-route to
  AForce Intelligence™, so routing no longer depends on a withheld tier.

This is the minimum-damage resolution: it gives Track 1 the umbrella it requires while fixing a
defect that already existed, and it does not strand the Meridian brand.

### R2 — HydroState™ is restated as the load-bearing centre, and every new system is subordinate to it

Track 1's framing ("HydroState™ is the foundational state engine and single hero metric";
everything else "operates around and through" it) is **already** Constitution Principle 2. The
reorganization does not introduce this — it makes the existing principle structurally visible.

Binding consequence for Part 3: no Track 2 system may emit a competing headline number.

### R3 — Track 2 proceeds only via an explicit recorded founder authorization

Per A3, the V1 lock is extensible by founder instruction and has been extended before. Track 2
requires the same instrument: a decision record, approved by Julius and Brandon, that names the
four systems and amends the lock clause. **[JB]** — Part 5, Decision 1.

### R4 — New sections are allocated into the vacant §38–42 band; §43–46 stay reserved

Per A4 the band is unclaimed and sits in the right structural position. Allocating three of nine
slots leaves deliberate headroom rather than consuming the space.

### R5 — Living Performance Model™ expansion amends §61; it does not become a new section

Build Rule 6 (extend, never parallel) and Build Rule 8 (the LPM modules are already named and
phase-tagged inside §61). Creating a new section for LPM would fork a tested system.

### R6 — The governance mirror is repaired and made single-source

A5 is a defect and should be fixed regardless of whether Track 2 is approved. Two options:

- **(a) Delete the mirror; point `CLAUDE.md` at `governance/` as the single source.** Removes the
  drift class entirely. **Recommended.**
- (b) Keep the mirror, complete it, and add a CI check that fails on divergence.

**[JB]** — Part 5, Decision 4.

### R7 — One authoritative locks document; the other three cross-reference it

Resolves A6. `governance/` holds the locks; `replit.md`, `SPEC-SHEET.md`,
`AForce-OS-Specification.md`, and `AFORCE_FINAL_SPEC.md` replace their restatements with
references. Mechanical, no semantic change. Proposed as a **follow-on**, not bundled into Track 2.

---

# PART 3 — SPECIFICATION

Conditional on Part 5 approval. Written to slot into `Architecture-Appendix.md` in house style,
each carrying a Status tag.

## §38 — Performance Knowledge Graph™

**Status:** Build Now (architecture, headless) · Phase 2 (any surface)

The structured, per-user substrate that records **what this person's body has actually
demonstrated**. Not a new data source — a new *organization* of data the OS already collects.

- **Nodes:** contexts (heat, travel, poor sleep, training load), behaviors (completed commands,
  logged intake, timing), and outcomes (recovery movement, follow-through, Confidence After
  Action). Nodes are created only from **real recorded events** — never inferred, never seeded.
- **Edges:** observed co-occurrence between a context, a behavior, and an outcome, each carrying
  an **observation count**, a **confidence** value, and **provenance** (which ledger events
  produced it).
- **Absence is not evidence.** A missing edge yields "not enough data yet" — never a favorable
  default. This mirrors the existing ledger rule.
- **Score-Protection:** read-only with respect to score. The graph never dispatches a reducer
  action and never awards, mutates, or fabricates score.
- **Feeds:** Evidence Engine™ (explanation), §39, §40, and the §61 expansion.
- **Language:** the graph itself is never surfaced as a graph. Users never see nodes or edges.

**Why it earns its place (Constitution gate):** it is the first structure that lets the OS answer
"what has *this person's* body taught us" with provenance, which Principle 4 and Principle 13
both demand and which no current structure supports.

## §39 — Prediction Engine™

**Status:** Architecture Only at approval · Build Now only after §42 language pass is accepted

Forward-looking projection from §38, expressed strictly as **observation extended forward**.

- **Data sufficiency gate.** Follows the §60 precedent: flag defaults **off** and stays off until
  the user has sufficient personal history (threshold in config, proposed 60–90 days). Below the
  gate the engine returns *insufficient data* — never a low-confidence guess.
- **Confidence is mandatory and visible.** Every projection carries a confidence band sourced
  from the underlying edge confidence. A projection that cannot state its confidence is not
  emitted.
- **Language rule (non-negotiable, inherits §59).** Cause-and-effect from the user's own history
  only. Never *risk*, *injury*, *diagnosis*, *prevent*. Never population comparison.
  - Permitted: "On days like this, you've told us you feel best when you start earlier."
  - Prohibited: "You are at risk of dehydration." / "This prevents cramping."
- **Never a medical forecast.** It projects *the user's own demonstrated response pattern*, not a
  health outcome.
- **Score-Protection:** advisory-only, per DR-001 precedent.

**This is the highest-compliance-risk system in the proposal.** §42 exists specifically to gate
it, and Risk-Register CR-1 (pre-launch claims review) should cover it explicitly.

## §40 — Performance DNA™

**Status:** Architecture Only · Phase 2+ surface

The stable, slow-moving traits §38 has established about this person — the durable signal
underneath day-to-day variation.

- **Qualitative, not a score. [Principle 2]** Performance DNA™ emits **traits with confidence**,
  never a number, never a grade, never a rank. Examples of trait shape: *responds strongly to
  early hydration*, *heat-sensitive*, *recovers fast from short sleep debt*.
- **Explicitly subordinate to HydroState™.** It may never be rendered as a headline figure, never
  placed in the orb, and never compared between users. HydroState remains the only hero metric.
- **Slow to change by construction.** Traits require sustained evidence to form and sustained
  counter-evidence to revise, so the surface cannot flicker.
- **User-owned framing.** "Your body taught us" register, per §61.
- **Score-Protection:** advisory-only.

## §41 — Intelligence Provenance & Retention

**Status:** Build Now (with §38)

Cross-cutting rule, not a feature. Every claim §38–40 or §61 makes must be able to name the
recorded events it came from.

- Any surfaced statement resolves to its source events on demand — this is what makes
  Constitution Principle 3 (explainable in plain language, using the user's own data) mechanically
  enforceable rather than aspirational.
- Retention and deletion inherit the Privacy Center (§51) contract; deleting source events
  invalidates the derived edges, traits, and projections built from them.
- Answers Principle 7 ("who sees this data, and why") before any of §38–40 ships.

## §42 — Prediction & Trait Language Compliance Pass

**Status:** Build Now (required revision, not a new feature) — **blocking gate on §39 and §40**

Modeled on §63, which set the precedent that a compliance pass is itself a numbered section.

- Enumerates permitted and prohibited phrasing for projections and traits.
- Extends the §59 banned-term rule to every §39/§40 output surface, including voice.
- Requires that recurring or severe symptoms always route to physician consultation.
- **§39 and §40 may not surface to any user until §42 is accepted.**

## §43–46 — Reserved

Intentionally unallocated. Do not assign without a decision record.

## §61 — Living Performance Model™ (AMENDED)

Existing status preserved: Build Now (daily lesson) · Phase 2–4 (Your Body's Manual, Confidence
Journey, Legacy summary). The amendment changes the **source**, not the surface contract:

- The daily lesson may additionally draw on §38, not only the §59 Personal Response Library.
- Your Body's Manual is specified as the **user-facing read of §38** — the accumulated, plain-
  language record of what the body has demonstrated. This is the natural home for the graph.
- Confidence Journey is specified as the **history of §41 provenance confidence over time**.
- All existing §61 locks carry forward unchanged: "your body taught us" framing; Silent
  Intelligence on-track state instead of a manufactured lesson; Legacy summaries never use
  prevention or causal medical language.

---

# PART 4 — IMPLEMENTATION DESIGN

Design only. Nothing below has been built.

## 4.1 Placement

```
artifacts/aforce-os/
  types/
    knowledgeGraph.ts              NEW  node/edge/provenance types
    prediction.ts                  NEW  projection + confidence band types
    performanceDna.ts              NEW  trait types (no numeric score)
  utils/intelligence/
    knowledgeGraph/
      buildGraph.ts                NEW  ledger events -> nodes/edges (pure, RN-free)
      queryGraph.ts                NEW  read helpers for §39/§40/§61
      provenance.ts                NEW  §41 claim -> source events
    predictionEngine.ts            NEW  §39 (pure, RN-free)
    performanceDna.ts              NEW  §40 (pure, RN-free)
    livingPerformanceModel.ts      EXTEND §61 — additive source, existing exports unchanged
  services/
    knowledgeGraphStore.ts         NEW  app-layer persistence (AsyncStorage)
  config/hydroStateModel.ts        EXTEND thresholds only
  featureFlags/flags.ts            EXTEND new flags, all default false
```

Rationale: `utils/intelligence/` is the established home for exactly this class of module, and
the pure/RN-free split (logic in `utils`, persistence in `services`) is the pattern
`livingPerformanceModel.ts` + `hydroScanHistory.ts` already establish.

## 4.2 Non-negotiable engineering constraints

Carried directly from A7/A8 — these are the constraints that make the work safe:

1. **Pure and RN-free** (type-only imports) so everything runs under the existing vitest pure
   runner (`artifacts/aforce-os/utils/__tests__/**`).
2. **Score-Protection isolation.** No new module dispatches a reducer action or touches score.
   Reading score read-only for fail-closed gating is permitted (DR-001 precedent); awarding,
   mutating, or fabricating is not.
3. **Built on the existing command-event ledger.** Additive adapters. No engine is rebuilt, no
   signature changes, existing tests stay green (Build Rule 6).
4. **Day-index conventions preserved round-trip** — local-calendar for check-ins, UTC floor for
   perf-age snapshots. Not normalized.
5. **Persistence follows `hydroScanHistory`**: defer writes until after boot-hydration; `clear()`
   bumps a generation counter and nulls the in-flight hydrate promise.
6. **Recorder effects** guard on both freshest-state existence check and an in-flight latch.
7. **All thresholds in `config/hydroStateModel.ts`** (Build Rule 13).
8. **No new tabs, no navigation change** (Build Rule 14). Every Track 2 surface lands inside an
   existing surface or stays headless.
9. **No fabrication.** Empty or low-confidence input yields the explicit insufficient-data state.

## 4.3 Feature flags — all default `false`

`spec_knowledgeGraph`, `spec_predictionEngine`, `spec_performanceDna`, `spec_lpmBodyManual`,
`spec_lpmConfidenceJourney`. Each with a strict flag-off short-circuit that returns before any
ledger read or clock access, so production behavior is byte-identical while dark.

## 4.4 Test strategy

Mirroring `utils/__tests__/livingPerformanceScoreProtection.test.ts`, each system ships with:

- a Score-Protection test proving no reducer dispatch and no score mutation;
- a no-fabrication test proving empty/low-confidence input yields insufficient-data;
- a language-compliance test asserting no banned term (*risk, injury, diagnosis, prevent*) can
  appear in any emitted copy key — the mechanical enforcement of §42;
- a provenance test proving every emitted claim resolves to real source events.

## 4.5 Proposed build phases

Each phase is one section, tested and confirmed before the next (Build Rules 2, 3). Approval is
per phase, not blanket.

| Phase | Scope | Gate to proceed |
|---|---|---|
| **T2-0** | Repair the governance mirror (R6). Independent of Track 2 approval. | — |
| **T2-1** | §41 provenance types + §38 graph, headless, flag-off. No surface. | Tests green; Score-Protection proven |
| **T2-2** | §42 language compliance pass, incl. the mechanical banned-term test | **Founder sign-off — blocks T2-3** |
| **T2-3** | §39 Prediction Engine, headless, behind data-sufficiency gate | §42 accepted |
| **T2-4** | §40 Performance DNA, headless, traits-only | Principle 2 review |
| **T2-5** | §61 expansion — Your Body's Manual reads §38 | Surface review |
| **T2-6** | Surfacing behind flags, phase by phase | Per-surface approval |

Highest-risk phase is T2-3; T2-2 exists to gate it. T2-1 is the only phase with no external
dependency and is the natural first increment.

---

# PART 5 — APPROVAL GATE

**Implementation stops here.** The following decisions are required before T2-1 begins.

### Decision 1 — Amend the V1 lock clause to authorize four new systems **[JB]**

Architecture V1 says "no new branded systems beyond what is specified here" (A3). Track 2
introduces Performance Knowledge Graph™, Prediction Engine™, Performance DNA™, and the Living
Performance Model™ expansion. §58–64 set the precedent that the lock extends by explicit founder
instruction. **Requested:** approve the amendment, or narrow Track 2.

### Decision 2 — Confirm R1: AForce Intelligence™ as umbrella, Meridian™ as tier only **[JB]**

This resolves the Track 1 requirement and fixes the pre-existing Meridian™ overload (A1, A2). It
changes the meaning of a trademark already used in shipped specs. **Requested:** confirm, or
supply the preferred split.

### Decision 3 — Confirm the §38–42 allocation, with §43–46 reserved

Uses vacant, unreferenced numbering (A4). Low risk; flagging because section numbers are
governance-visible and permanent.

### Decision 4 — Choose the mirror repair: delete (recommended) or complete + CI check **[JB]**

A5 is a live defect independent of Track 2 — the in-tree mirror currently tells an agent that
HydroScan may write into HydroState, which DR-001 forbids. **This should be fixed regardless of
how Decisions 1–3 land.**

### Decision 5 — Confirm Performance DNA™ emits traits, never a score

Principle 2 forbids a competing hero metric. §40 is specified as qualitative traits only. If the
intent was a single memorable "DNA score", that conflicts with the Constitution and needs an
explicit constitutional change under Change Control, not a spec decision.

### Decision 6 — Accept that §39 cannot surface until §42 is accepted

Prediction is the highest compliance-risk system here (A7). Confirm the language pass gates it.

### Open question — Phase placement

§38 is proposed Build Now (headless). §39/§40 are proposed Architecture Only until their language
and Principle-2 gates clear. `Phase-Roadmap.md` will need a corresponding entry. Confirm the
phase assignment.

---

**On approval of Decisions 1–6, implementation begins at T2-1 and stops at its gate for review.**
