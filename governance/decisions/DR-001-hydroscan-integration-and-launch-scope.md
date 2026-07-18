# DR-001 — HydroScan Integration Rule, HydroScan 2.0 Scope, and §62 Founder-Mode Open Questions

- **Status:** ACCEPTED — settled. This record documents rulings the founder has already
  made. It is not an open question and is not a request to reconsider. It is reversible
  only through the explicit revisit criteria stated per item.
- **Date:** 2026-07-17
- **Owner / decider:** Brandon (founder)
- **Deciders on any future change:** named per item under Revisit Criteria
- **Governs:** `governance/Architecture-Appendix.md` §28–37 / §62; `docs/AFORCE_OS_ARCHITECTURE_V1.md`
  §28–37; the Score-Protection isolation implemented in
  `artifacts/aforce-os/services/hydroScanHistory.ts` and
  `artifacts/aforce-os/services/hydrationScanService.ts`.
- **Related:** Risk-Register CR-1 (pre-launch claims/compliance review);
  `governance/AForce-Constitution.md` (Principle: observation never diagnosis; trust over
  attention); `governance/Section-62-Founder-Mode-Spec.md` §8 Open Questions.

---

## Decision 1 — §35 HydroScan Integration Rule is AMENDED to advisory-only for launch

### Status
ACCEPTED. In effect for the September 2026 launch. Score-Protection isolation is permanent
and is **not** part of what is deferred.

### Decision
Two things, held together:

1. **Score-Protection isolation STAYS (permanent).** A HydroScan never mutates HydroState,
   the performance band, Performance Memory, or the recovery score. A scan writes an
   advisory row only. The *only* path that mutates score is the explicit **"Log Intake"**
   tap. This is already how the code behaves: `hydroScanHistory.recordScan()` writes to
   AsyncStorage and never dispatches a reducer action — it cannot touch a hydration point,
   band, or recovery score "not even when the user answered 'Consumed: Yes'"
   (`services/hydroScanHistory.ts`), and the HydroScan 2.0 impact/timing fields in
   `services/hydrationScanService.ts` are explicitly "Advisory only (Score-Protection):
   these never award, mutate, or fabricate score."

2. **§35 is amended for launch.** The §35 language "HydroScan **must update** HydroState,
   Evidence Engine, Performance Memory, Command Confidence, Recovery Window, Tomorrow Load
   Forecast, AutoPilot, Guardian, Cruise, Clutch, Adaptive Profile, Global Adaptation
   Engine" is amended to: **"HydroScan surfaces ADVISORY signals only."** For launch,
   HydroScan informs the user; it does not write into the engines listed in §35.

### Options that were on the table
- **(a) Advisory-only, isolation preserved — CHOSEN.** Ship what the code already does:
  scans advise, only "Log Intake" moves score.
- **(b) Full §35 integration.** Wire HydroScan into all listed engines so a scan updates
  HydroState / band / Performance Memory / recovery, per the literal §35 text.
- **(c) Treat the isolation as the gap to close.** Read §35 as the spec of record and the
  current isolation as an unfinished implementation — i.e. a defect to fix before launch.

### Rationale — why (a) wins for launch
- **Score-Protection integrity.** The performance band and recovery score are the trust
  spine of the product. Under (b)/(c), a *scan* — a recognition step running on OCR/barcode
  heuristics and proxy inputs — could move a physiological-looking score. That makes the
  score jumpy and attackable ("I scanned a drink and my recovery score changed") and
  couples a soft signal to the hardest number in the app. (a) keeps one, and only one,
  auditable write path to score: the user's explicit "Log Intake."
- **Compliance exposure.** Letting a scan move a health-adjacent score converts an
  observation into something that reads as a physiological determination — the exact line
  the Constitution draws (observation, never diagnosis). It also compounds CR-1's existing
  concern about the "hydrates at X% efficiency" numeric claim: a heuristic that *also*
  silently moves a recovery score is a materially larger claim to defend. Advisory-only
  keeps scans on the safe side of that line for launch.
- **Launch timeline.** (b)/(c) require wiring HydroScan into up to twelve engines, each
  needing its own re-validation of scoring behavior against `scoringEngine.ts` /
  `statusColor.ts` (off-limits, source of truth) — a large, score-touching surface to build
  and test before September 2026. (a) is already built, already tested, and already
  isolated. It is the shippable option that does not put the scoring engine at risk on the
  critical path.

### Why the alternatives lose
- **(b) Full integration** is the highest-risk option on the shortest timeline. It puts a
  soft, heuristic signal on a direct write path to the product's most trust-critical numbers
  and enlarges the compliance surface right before launch. It is a post-launch candidate,
  not a launch requirement.
- **(c) Isolation-as-gap** mis-frames a deliberate safety property as a defect. The
  isolation is intentional and load-bearing; "closing" it is identical in effect to (b) and
  loses for the same reasons.

### Consequences
- §35 as written no longer describes launch behavior. Until the Architecture Appendix is
  amended in place, **this DR is the controlling record** for §35 at launch.
- HydroScan history is a local, bounded (`MAX_ENTRIES = 100`), advisory log. It does not
  feed Performance Memory or any engine at launch.
- The single score-write path ("Log Intake") must stay the single score-write path. Any PR
  that makes a scan dispatch a score-mutating reducer action contradicts this decision and
  must be flagged, not merged.
- The isolation is now a **guarded invariant**, not an implementation detail — treat a
  regression of it as a governance breach, not a refactor.

### Post-launch revisit criteria (when fuller integration may be reconsidered)
Revisit only when there is evidence that advisory-only is leaving user value on the table
*and* that a fuller wire-in can be done without destabilizing the score. Concretely, any of:

1. **Personal-data maturity.** Enough per-user scan + outcome history exists (order of the
   60–90 day personal-data thresholds already used for Response Timeline §60 / Living
   Performance Model) that Decision Memory (§34) could improve recommendations by feeding
   Performance Memory — with the write still gated and auditable.
2. **Recognition confidence is high enough to move a score.** Scan recognition and the
   impact/efficiency heuristics have measured accuracy sufficient that letting them nudge a
   score would raise, not lower, score trust. Decision Confidence (§31) "Limited" scans must
   never write.
3. **A demonstrated user-value gap** attributable specifically to isolation (not to some
   other cause), documented from beta/production behavior — not a hypothetical.

**Gate on any such change:** because it would make a scan move a health-adjacent score, it
requires **performance-scientist sign-off** (physiology + recognition-accuracy evidence) AND
**outside counsel sign-off** (claims/compliance), in addition to the founder. It is an
irreversible-class change (it alters what the score means) and therefore also requires a
written one-page rationale in `governance/decisions/` before any code. Score math itself
(`scoringEngine.ts`, `statusColor.ts`) remains off-limits regardless.

---

## Decision 2 — HydroScan §32 / §33 / §34 / §29-OCR are POST-LAUNCH

### Status
ACCEPTED. Deferred to post-launch. These are **deferred scope, not defects.**

### Decision
Do not build the following before launch. Where already built-but-dark, they stay dark
behind their feature flags and are gated by **CR-1** (the pre-launch claims/compliance
review) before any enablement:

- **§32 — Product Strengths & Today's Considerations** (Strengths / Today's Considerations /
  Next Best Action framing).
- **§33 — Recovery Intelligence** ("optimize around this decision" recovery plans).
- **§34 — Decision Memory** (scans becoming part of Performance Memory over time).
- **§29 — OCR ingredient / label / Supplement-Facts scan** input path.

These are the "HydroScan 2.0" items. Where the code already contains them behind the
`hydroScan2` flag (`services/hydrationScanService.ts` attaches Hydration Impact + Timing
Guidance *only* when `opts.hydroScan2` is passed; when off, the result is byte-identical to
the legacy shape), the flag stays off for launch.

### Rationale
- **Not a defect — a scope line.** The built-but-dark surface is intentional. It exists
  behind flags precisely so it can ship later without a rebuild; leaving it dark is the
  designed state, not an incomplete feature.
- **Every one of these carries an unresolved claim.** §32/§33/§34 generate user-facing
  guidance and OCR expands the input surface into arbitrary labels — all of which surface
  claims (efficiency numbers, superfood structure/function copy, recovery guidance) that
  CR-1 is the single deliberate go/no-go for. Enabling any of them before CR-1 clears them
  would ship an un-reviewed claim.
- **Launch scope discipline.** The core HydroScan (§28/§30/§31/§36/§37 advisory path) is
  enough for launch. 2.0 adds surface and claim exposure without being launch-critical.

### Consequences
- `hydroScan2` and any §32/§33/§34/§29-OCR flags default **off** in production at launch.
- CR-1 is the enable gate. No 2.0 surface is turned on until CR-1 clears its specific copy
  (see Risk-Register CR-1: the "hydrates at X% efficiency" claim and superfood copy are
  already named on CR-1's list).
- Because these are deferred (not broken), they do **not** count against launch quality
  bars and must not be logged as bugs.

### Post-launch revisit criteria
Enablement is unblocked when **CR-1 clears the specific copy** for the item in question and
its feature flag is turned on deliberately. Per-item enablement (e.g. §32 may clear before
§29-OCR); CR-1 sign-off is per-claim, not a blanket switch. No performance-scientist/counsel
escalation beyond CR-1 is required for these **as long as they remain advisory-only** — the
moment any of them is proposed to write into a score, Decision 1's dual sign-off gate
applies.

---

## Decision 3 — §62 Founder-Mode open questions Q1, Q3, Q5 are DEFERRED to the post-launch spec review

### Status
ACCEPTED. Q1, Q3, Q5 deferred to the post-launch §62 spec review. **Q5 is additionally
counsel-gated regardless of that review.**

### Decision
The following §62 open questions (`governance/Section-62-Founder-Mode-Spec.md` §8) are not
resolved now and are carried to the post-launch spec review:

- **Q1 — Sandbox = schema, not a second database.** Whether Founder/Engineering Sandbox
  lives as a `sandbox` schema in the one Neon instance (the spec's choice, chosen to avoid
  the documented two-database trap) or requires a fully separate Sandbox database. Deferred.
- **Q3 — Sandbox write persistence & multi-founder sharing.** Whether Time Travel / Scenario
  runs persist in the shared `sandbox` schema or are per-session ephemeral. (Spec's working
  recommendation: ephemeral by default with an explicit "save to Sandbox" action.) Deferred.
- **Q5 — Competitor-scenario physiology.** The Scenario Engine's required
  documented-competitor-failure scenario (the sodium-only-cramping case) and its underlying
  physiology claim. Deferred to the spec review **and** independently counsel-gated (below).

Founder Mode is internal-only and never exposed in Production, so none of these blocks
launch; they are resolved when the internal §62 surface is actually built out post-launch.

### Rationale
- **Internal-only, non-launch-critical.** §62 writes to Sandbox only and never appears in
  Production. Q1/Q3 are infrastructure-shape questions for an internal tool; deciding them
  now would be premature and reversible-later work spent off the launch critical path.
- **Q1/Q3 are reversible.** Schema-vs-database and ephemeral-vs-persistent are engineering
  calls that can be made fast when the surface is built; they carry no external exposure and
  no user-facing claim, so they wait.
- **Q5 is different in kind.** The competitor-failure scenario asserts a *physiology* claim
  (sodium-only replacement failing to resolve cramping) that would be shown as fact. That is
  a health-adjacent claim about a named competitor pattern — outside our internal authority
  to ratify. The §62 spec itself already states architecture defines the scenario's
  structure but "does not ratify the physiology."

### Q5 — counsel gate (independent of the spec review)
Q5 is marked **counsel-gated regardless.** Even after the internal post-launch spec review
would otherwise clear it, the competitor-failure scenario's physiology claim must be
**validated and cited by the performance-scientist agent AND cleared by outside counsel**
against `docs/COMPLIANCE_FRAMEWORK.md` before it ships in any form (including internal
Founder/Demo surfaces that could ever be shown to investors). Internal review can approve
the scenario's *structure*; it cannot approve the *claim*. This gate stands on its own — the
spec review passing does not satisfy it, and it does not lapse with time.

### Consequences
- Q1, Q3, Q5 remain OPEN in the §62 spec's §8 and are tagged as deferred-to-post-launch-review.
- The §62 M7 milestone (Scenario Engine + documented competitor-failure scenario) cannot
  ship the competitor scenario until both the performance-scientist citation and outside
  counsel clearance exist for Q5 — even for internal use.
- Q2, Q4, Q6 are **not** covered by this decision and follow their own tracks (Q4 in
  particular may be a shared-file change requiring approval under the working agreement).

### Post-launch revisit criteria
- **Q1 / Q3:** revisited at the post-launch §62 spec review, when the internal Founder-Mode
  surface is actually being built. No external sign-off required; founder + engineering call.
- **Q5:** revisited at the same review for structure, but **shipping the physiology claim
  requires performance-scientist citation + outside counsel clearance**, independently and
  in addition. Absent both, the competitor-failure scenario ships with no physiology claim,
  or does not ship.

---

## One-line summary
Score-Protection isolation is permanent and §35 is advisory-only for launch (Decision 1);
HydroScan 2.0 §32/§33/§34/§29-OCR stay dark behind flags gated by CR-1, deferred not broken
(Decision 2); §62 Q1/Q3/Q5 defer to the post-launch spec review, with Q5's competitor-
physiology claim counsel-gated regardless (Decision 3).
