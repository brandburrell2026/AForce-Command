# DR-013 — Moments / RecoveryCommand authority (§10 reconciliation) — founder ruling

**Date:** 2026-08-30
**Deciders:** Brandon (founder) — RULED, explicit. **Julius — countersignature
PENDING** (DR-010/DR-011/DR-012 precedent: the record stands on the founder's
ruling; implementation remains separately authorized).
**Directive:** `/aforce-world-class-release` §10 — "RecoveryCommand
eligibility" (the reconciliation this record closes).
**Related:** DR-010 (Moments allocation + prep notifications), DR-011 (calendar
core), DR-012 (learning loop), `COR-002-SCORE-OWNERSHIP-REGISTER.md`
(HydroState is the only hero metric; nothing else issues independent commands).

---

## Why this record exists

The §10 reconciliation has been open since the polish tranche of 2026-08-29,
when a four-screen command-consistency check found a Moment presenting a
hydration dose alongside a different canonical Home command. That surface was
traced and classified at the time as **chartered-but-unreconciled** and
deliberately left unchanged pending this ruling; PR #885 recorded it rather
than silently "fixing" it. E3 (PR #888) likewise renders both exactly as
production does and does not resolve them.

This record states the authority boundary. It does not implement it.

## Ruling 1 — Ownership

**Moments owns context and timing relevance. RecoveryCommand owns the
hydration action.**

Moments answers *what is coming, when preparation matters, and why this moment
deserves attention*. RecoveryCommand answers *what the member should do about
hydration*. These are different questions and only one of them is an
instruction.

## Ruling 2 — Mirror-exact, or nothing

If a Moments surface presents a hydration **dose, amount, unit or action**, it
must **mirror the currently eligible canonical RecoveryCommand exactly.**

Moments may NOT:

1. calculate its own dose
2. cap the canonical dose
3. broaden it into a range
4. narrow it
5. round it independently
6. change units
7. change urgency
8. create a separate recheck clock
9. substitute a product recommendation

This list is exhaustive of the prohibited transformations and is not a
guideline: any of the nine is a violation regardless of intent or of how
reasonable the transformed value looks.

## Ruling 3 — Absence is not a licence to invent

**If there is no eligible canonical RecoveryCommand, Moments may still explain
the preparation context, but it must not manufacture a hydration action.**

An empty command is a truthful state. The correct Moments presentation in that
case is context only — what the moment is, when it is, why preparation matters
— with no dose, no amount, and no imperative.

## Ruling 4 — Upstream influence is allowed; member-facing authority is not

Context Arbitration / Moments **may influence eligibility upstream** through
the approved architecture (the existing
Context Arbitration → RecoveryCommand → Evidence Engine → Decision Guard
delivery order). What Moments may never do is author the member-facing action.
Influence flows upstream into what the canonical command becomes; it does not
flow sideways into a second command.

**The member-facing action remains RecoveryCommand-authoritative.**

## Scope of this record

- This is a **ruling record only.** The full §10 lifecycle architecture
  (eligibility model, mirror plumbing, the surfaces that must change) is **not
  implemented by this record** and is not implemented by the two hardening PRs
  that accompany it (stale/offline truth; E3 hardening) — both are explicitly
  scoped to exclude it.
- Implementation requires its own founder authorization, and should carry its
  own lock proving the mirror is byte-exact and that the no-command path
  manufactures nothing.
- Until then, the known unreconciled surface stays as-is and stays recorded.

## Precedent this ruling is consistent with

The same principle has already been enforced three times at the code level,
each time by removing a second command rather than reconciling two:

- **PR #884** — `scanCoachVoice` stopped authoring dose/timing and now mirrors
  `result.recommendation.command` verbatim.
- **PR #885** — Protocol stage descriptions stopped acting as an independent
  dose authority and now defer to the member's current command.
- **PRs #876–#879** — the Decision Guard seam, which can block any delivered
  command and records the result in the ledger.

DR-013 generalises that pattern into the standing rule for Moments.
