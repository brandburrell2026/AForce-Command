---
name: AForce adaptive reminder policy
description: How "smarter reminders" is modeled given there is no recurring reminder generator — a pure policy that gates the existing surface.
---

# Adaptive reminder policy

AForce has **no recurring hydration reminder generator** — the only reminder
surface is the fixed Day-0/1/3/7 welcome cadence (1/calendar-day), shown via the
home notification banner. "Adaptive reminders" is therefore a **pure decision
engine consulted as a gate** on top of that cadence, not a new scheduler.

**Why:** Inventing a recurring reminder loop would add surface/complexity that
the build lock forbids and that nothing else needs yet. Gating the existing
surface keeps it honest: the engine decides allow/suppress + a frequency budget
(effective max/day, min-gap, intensity) that any future generator can also read.

**How to apply:**
- Levels (minimal/standard/aggressive) set the *baseline*; rules adapt intensity;
  hard guardrails (min-gap floor, max/day ceiling) bound it so fatigue is
  impossible at any level/context.
- Workout/heat are dehydration-risk signals and **override** the softer
  goal-complete suppression (but never override sleep, cap, or min-gap).
- There is no quiet-hours user setting; sleep suppression uses default local
  quiet hours and the window check must handle the midnight wraparound.
- The "ignored" signal comes from analytics responseRate **with a sample-size
  guard** — never throttle on a tiny sample.
- Only count an analytics "shown" when the gate actually allows the reminder;
  load level/analytics async with safe defaults so a due reminder is never
  hidden while storage resolves.
