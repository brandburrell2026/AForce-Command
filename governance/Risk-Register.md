# AForce OS — Risk Register

Maintained by **scrum-master** (see `.claude/agents/scrum-master.md` → "Standing
risk register discipline"). Tracks: launch-critical path to September, money-path
open items (these never silently age), credential/security items, and any
"verified locally but not live" gap. An item blocked more than two sessions gets
escalated to **ceo** with a proposed unblock.

Status legend: **OPEN** · **PENDING-DECISION** (needs a human call, not code) ·
**BLOCKED** · **RESOLVED**.

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
