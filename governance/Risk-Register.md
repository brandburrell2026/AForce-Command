# AForce OS — Risk Register

Maintained by **scrum-master** (see `.claude/agents/scrum-master.md` → "Standing
risk register discipline"). Tracks: launch-critical path to September, money-path
open items (these never silently age), credential/security items, and any
"verified locally but not live" gap. An item blocked more than two sessions gets
escalated to **ceo** with a proposed unblock.

Status legend: **OPEN** · **PENDING-DECISION** (needs a human call, not code) ·
**BLOCKED** · **RESOLVED**.

**Counsel of record / legal routing (AForce OS):** J. Peter Paredes —
patent@awglaw.com (AWG Law). **Scope: patent/IP only** (confirmed 2026-07-18). Owns
patent/IP matters — including PA-1 below — and is the routing contact for that lane.
**Does not** cover CR-1's pre-launch **claims/compliance** review: that is a separate
regulatory specialty and its reviewer is **still unbooked** (Launch-Readiness human
action #1). Do not treat CR-1 as covered by patent counsel.

---

## Pending decisions

### RD-1 — Enable Section 64 (Conversational Intelligence) in production
- **Status:** PENDING-DECISION · **Owner (decision):** Brandon · **Opened:** session 2026-07-17
- **Framing (explicit):** This is a **launch-readiness decision milestone, not a
  code step.** Both halves of §64 are built and merged — proactive (Steps 1–3)
  and reactive full-context / rule 5 (Step 4) — and both are **gated OFF in the
  production binary** (`conversational_intelligence_enabled: false`). Do **not**
  drive toward enabling as a default. It is decided **deliberately**, on the
  launch-readiness list, **not mid-runway.**
- **What the decision requires, in one review:**
  1. The **full section validated** end-to-end (not step-by-step) — proactive +
     reactive behavior exercised together against real app state.
  2. The **claim copy signed off** in a single performance-scientist claim
     review of every user-facing coach line (the §64 Step 4 review already
     reworded the reactive personal line from a false readiness attribution to
     own-data logged-energy co-occurrence; a full sign-off covers all lines at
     once).
- **Flip mechanics (for when the decision is made):** the two flag entries in
  `artifacts/aforce-os/featureFlags/flags.ts` (base = OFF; internal-inspection =
  ON). No behavior code changes — the gates are already in place.
- **Not blocked on engineering.** Blocked on the deliberate go/no-go.
- **Explicit gate (founder, 2026-07-17):** RD-1 **stays OFF** until the
  **pre-launch claims/compliance review (CR-1)** clears the §64 coach copy. It is
  not enabled as a default; the go/no-go is made at that review, not before.

---

## Open — Section 63 follow-ups (compliance pass shipped; these deferred by decision)

The §63 app-side compliance pass shipped in PR #253 (streak copy never threatens
loss; guard test across all locales). Two pieces were deferred **with the design
decided**, so neither can silently ship the wrong way. Detail in
`governance/Section-63-Compliance-Pass.md`.

### R63-1 — Comparative streak surfaces (leaderboards, territory, peer cards)
- **Status:** OPEN · **Owner:** Phase 2 (react-native-engineer + performance-scientist) · **Opened:** session 2026-07-17
- **Decision (do not re-litigate):** implementation deferred to **Phase 2** — these
  are §47–52, flag-gated, not in the launch binary, so **no launch-runway effort**
  goes here. But the design is decided so Phase 2 builds it right the first time:
  when competition lights up, **rank decouples from streak** (rank on a non-streak
  metric — active days / readiness), removing the loss vector at the source rather
  than papering it with copy. **Neutral-comparative copy is the floor regardless
  of metric** (state position/rank factually; never frame a rank drop as personal
  loss).
- **Guard-rail:** Phase 2 must not ship streak-weighted ranking un-reframed. This
  item is the reminder.

### R63-2 — Athlete Mode decay mechanic (never-empty-on-one-miss)
- **Status:** OPEN · **Owner:** backend / streak-owner (whoever maintains `complianceStreak`) · **Opened:** session 2026-07-17
- **Why it's not app-side:** the app receives `complianceStreak` **already zeroed
  on a miss** and cannot reconstruct carried-forward days from it, so the decay
  model (progress decays one day per missed day rather than emptying, so rebuilding
  is always shorter than starting over) must be produced upstream. The app-side
  copy pass already handles the language (neutral "new cycle", additive framing);
  **"carried-forward" user-facing language is coupled to this mechanic** and lands
  with it, not before.
- **Gate on delivery:** performance-scientist reviews the **mechanic**, not just
  copy — does a decay model read as momentum or as slow-motion loss? Fallback if it
  reads as loss: a single grace day per cycle. Own test for the homeDashboard
  logic; extend the streak language guard to the new surface.

---

## Pre-launch reviews

### CR-1 — Pre-launch claims / compliance review
- **Status:** PENDING-DECISION · **Owner:** Brandon + performance-scientist (+ counsel on edges) · **Opened:** session 2026-07-17
- **What it is:** the single deliberate review that signs off every user-facing
  claim before launch. It is the **gate for RD-1** (§64 enablement) and must also
  cover the HydroScan claims surfaced by the §28–37 audit:
  - §64 reactive/proactive coach copy (all lines, one pass).
  - HydroScan **"hydrates at X% efficiency"** — a precise numeric physiological
    claim from a heuristic + proxy input (`services/hydrationScanService.ts`).
  - **Superfood** structure/function copy (sea moss / dulse) — allowed/banned
    list exists; still warrants counsel sign-off under COMPLIANCE_FRAMEWORK §2/§14.
  - **Urine Hydration Check** verdicts — borders "observation, never diagnosis".
  - **Personalization copy (§56):** audit all user-facing AND marketing-adjacent
    copy against actual shipped behavior. Anything implying full-field calibration
    or a working Personal Baseline™ is **out of bounds until the mechanism
    exists** — "Personal Baseline" may appear **only as roadmap framing**. Flag any
    in-app strings that fail this test.
- **Rule:** nothing on this list ships until it clears here. Governs by
  `docs/COMPLIANCE_FRAMEWORK.md`. Not a code step — a deliberate go/no-go.
- **Booking (human, will not self-surface):** the regulatory specialist must be
  booked for this review — it does not happen without that engagement.

---

## §56 Universal Personalization — scope + reserved levers

### S56-1 — §56 build scope (founder ruling, 2026-07-17)
- **Status:** IN PROGRESS — Coverage-qualifier layer + §20 calibration wiring.
- **Personal Baseline primitive** (learned averages superseding population) is
  **post-launch, gated behind ruling ④ (cybersecurity + counsel).** **No
  persistence of learned physiological data** before that ruling exists.
- The §56 audit and its internal language are **internal governance documents.**
  Any external / build-status summary for outside parties is written **FRESH** as
  shipped / dark-pending-compliance / roadmap — never excerpted from the audit.

### RL-1 — Ruling ⑤: a personalization field must enter the core score — RESERVED (LOCKED)
- **Status:** RESERVED · **never exercised pre-launch under any circumstances.**
- Making a field move the core HydroState score requires editing the off-limits
  scoring engine. Any proposal that requires it is **post-launch by definition** —
  route as a written proposal to Brandon, not a build task. §56's coverage layer
  reports such fields (e.g. `sex` on HydroState) in a separate `scoring-locked`
  bucket, never as an actionable miss.

---

## IP / corporate

### PA-1 — Patent assignment: Aforce Group LLC → AForce Hydration, Inc.
- **Status:** PENDING-DECISION — verification pending with counsel · **Owner:** Brandon
  + counsel (J. Peter Paredes, patent@awglaw.com) · **Opened:** session 2026-07-18
- **What it is:** the AForce OS patent/IP rights must be assigned from **Aforce Group
  LLC** to **AForce Hydration, Inc.** (the operating entity for this repository). The
  assignment / chain of title is **not yet verified** — confirmation is pending with
  counsel.
- **Why it matters:** clean chain of title to the operating entity is standard
  pre-launch / pre-financing IP hygiene; an unverified assignment is a diligence gap
  that does not surface on its own.
- **Next (human, will not self-surface):** counsel (Paredes / AWG) confirms the
  assignment is executed and recorded; move to RESOLVED on written confirmation.
