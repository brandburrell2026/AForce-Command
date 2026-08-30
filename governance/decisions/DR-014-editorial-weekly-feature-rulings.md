# DR-014 — Editorial Weekly (The Feature): headline, TOP COMMAND, and the paper register — founder rulings

**Date:** 2026-08-30
**Deciders:** Brandon (founder) — RULED, explicit, on PR #893 (E5). **Julius —
countersignature PENDING** (DR-010 through DR-013 precedent: the record stands
on the founder's ruling).
**Directive:** AForce Editorial OS migration, step E5 — Weekly Report / The
Feature.
**Related:** DR-013 (Moments / RecoveryCommand authority — the Feature carries
the canonical next-week focus and authors no instruction of its own),
`AForce-Constitution.md` (observation never diagnosis; trust over attention).

---

## Why this record exists

E5 (PR #893, merged as `996d7661`) migrated Weekly Report onto the Editorial OS
as **The Feature**, the first surface in the migration to render on **paper**
stock rather than the black OS ground.

Two questions were raised from the implementation rather than decided by it,
and were carried to the founder instead of being resolved in code:

1. the approved comp shows an **authored headline** for which no data source
   exists; and
2. the live V3 surface renders a **TOP COMMAND** banner that E5 omits.

Both were documented on the screen and flagged in the PR. They are now ruled.
Three further rulings confirm decisions the implementation had already taken
under the E5 scope authorization.

This record states the rulings. R1 and R2 additionally became lock-protected in
the follow-up that carries this file, because a docblock can be deleted and a
lock cannot.

## Ruling 1 — Weekly headline

**Do not invent, synthesize, or editorialize a weekly headline without an
approved canonical source.**

For E5 the Feature's primary furniture is the **real report title plus the real
date range**. No generated "story headline" is required.

A future authored headline may be considered **only** after a separate
owner / source / claims rule is approved. Until then, generating a per-week
headline is the class of fabrication Ruling R3 of E2 already bans: a headline
asserts a narrative about the member's week, and no module produces one.

## Ruling 2 — TOP COMMAND

**Keep TOP COMMAND omitted from Editorial Weekly while its instrumentation is
absent.**

Do not render an empty or "awaiting" section merely to preserve parity with
`WeeklyReportV3`. A panel whose only content is that it has nothing to report
spends the member's attention on an absence — the opposite of what the Feature
register is for, and a violation of trust over attention.

When a real governed source for command usage exists, TOP COMMAND returns as a
future addition, not as a restored placeholder.

## Ruling 3 — Analytics asymmetry

**Preserve the current E5 behaviour and keep the analytics asymmetry on its
separate lane. Do not broaden E5 to solve it.**

A failed `getAnalyticsSnapshot` still renders as a lived-but-empty week on the
**live** `WeeklyReportV3` surface — the same swallow-and-echo shape Lane A
closed for the Home refresh path, surviving on a different source. It is a
defect on what members see today, and fixing it inside a flag that is `false`
would leave production wrong for however long the flag stays off.

E5 therefore carries the shape over unchanged and deliberately. The remediation
is its own lane against the live surface, unstarted and separately authorized.

## Ruling 4 — The paper register

**The paper register and all paper-surface contrast fixes are accepted.**

**Preserve the no-positive-hue-on-paper rule** unless a later accessibility or
brand ruling changes it.

The measurement behind it: `edPositive` (Soursop Green `#1FA35A`) is **5.96:1
on black stock** and **2.48:1 on paper** — below the 4.5:1 text floor and below
even the 3:1 graphical floor. It had shipped on three editorial screens with no
contrast coverage on either stock. On the Feature, positive reads through
weight, rule and position; the direction of a Performance Age move survives as
a glyph and a spoken sentence, never as colour alone.

Recorded with it, because it will recur on every future paper surface:
`AFScreen` paints `af.canvas` (`#0D0D0D`) on its own shell unconditionally, so
nesting it inside a paper `EdSurface` covers the sheet and leaves paper ink at
~1.1:1. The stock must be restated on the shell. The same class applies to any
`af.*` component built for the dark canvas.

## Ruling 5 — Chart truth

**The corrected bar orientation and score-direction math are accepted and must
remain lock-protected.**

Both bar charts had rendered their fill before the spacer, hanging every bar
from the top; the weekly timeline additionally took the *complement* of the
day's score, so a high score drew a short bar. A chart that inverts its own
reading is a truthfulness defect, not a cosmetic one.

Order and magnitude are pinned separately in
`components/__tests__/editorialWeeklyLaw.test.ts`.

## What this record does NOT do

- It does not flip any go-live flag. `editorial_home_enabled`,
  `editorial_moments_enabled`, `editorial_protocol_enabled` and
  `editorial_weekly_enabled` all remain `false` in production defaults.
- It does not authorize the analytics-asymmetry lane, a future authored
  headline, or the return of TOP COMMAND.
- It does not authorize E6.
