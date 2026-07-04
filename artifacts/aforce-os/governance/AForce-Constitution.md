# AForce OS Constitution

**Version:** 1.0
**Date Locked:** July 3, 2026
**Owners:** Julius Burrell, Brandon Burrell
**Status:** Locked

---

## Engineering North Star

When engineering faces a trade-off between shipping quickly and preserving long-term trust, **long-term trust wins.**

---

## Principles

1. **The body comes first. The recommendation comes second. The product comes last.**

2. **One hero metric. HydroState.** Never create a competing hero metric.

3. **Every recommendation must be explainable in plain language, using the user's own data.**

4. **The OS learns the individual, not the population.** Personal baseline always outranks population average once sufficient individual data exists.

5. **Observation, never diagnosis.** The OS notices patterns. It does not claim medical authority.

6. **The OS speaks only when speaking adds value.** Silence is itself a form of trust.

7. **Who sees this data, and why, must be answered before any feature ships.**

8. **Build once. Reveal over time.** Architecture is built complete; surfaces release in phases behind feature flags.

9. **Complete Architecture. Controlled Visibility.** AForce OS is built as one integrated operating system. Features may be hidden behind feature flags and phased releases, but the architecture is designed to work together from the beginning. New phases reveal capability — they do not require rebuilding the foundation.

10. **AForce OS exists to earn trust, not attention.** Every recommendation must make the next recommendation more trusted than the last. If trust is ever sacrificed for engagement, engagement loses. Every time.

11. **Never optimize for time spent in the app. Optimize for confidence outside the app.** Open app. Get command. Execute. Close app. Live life. Come back only when needed. (Stated exception: Guardian and Clutch, which serve a coach/staff safety relationship where active attention during risk windows is the explicit value delivered.)

12. **AForce OS does not exist to tell people about their bodies.** It exists to learn this person so well that every future recommendation becomes more personal, more trusted, and more effortless than the last.

13. **Your body teaches AForce OS.** AForce OS listens, remembers, and reflects what it learned back to you. It is never the one claiming to know best.

14. **Every new feature must prove it improves the operating system after one year of use** — not just the first day of use.

15. **Every conversation should make the next conversation shorter, more personal, and more useful.** The AI Coach is measured by reduction in required interaction over time, not by engagement volume. AForce OS is not a chatbot waiting for questions. It is a system that already understands the person well enough that fewer questions are ever necessary.

---

## The AForce Promise

**GATE (must pass to be considered at all):**

> Does this help us understand this person better?
> If no — stop. Nothing else matters. Do not evaluate against the constraints below.

**CONSTRAINTS (only apply if the gate is passed):**

- Can it be explained in one sentence?
- Does it reduce effort instead of adding effort?
- Will this still matter five years from now?

A feature that fails the gate does not ship, regardless of how simple, effortless, or durable it appears to be.

---

## The Three Question Rule

Applied before any feature ships, even if already designed:

1. **Does this make the OS know this specific person better?** If no, don't ship it.
2. **Does this make the user's day easier?** If no, don't ship it.
3. **Would the Founding 200 actually notice if we removed it?** If no, it probably shouldn't ship yet.

This third question exists specifically because founders often love features users barely notice. It keeps the team focused on delivering things that create obvious value.

---

## Quarterly Review Practice

Before any new major feature is approved for the next quarter, ask:

> "If we were starting AForce OS today, knowing everything we've learned, would we build this feature again?"

If no, remove it. This happens as part of the quarterly approval gate — not as a separate standing meeting that competes with shipping deadlines.

---

## Learning Journal Protocol

All Founding 200 feedback goes into `Learning-Journal.md` first. Nothing from a single beta tester is ever written directly into this Constitution or the Architecture Appendix. Only after a pattern emerges across multiple users does it graduate into a proposed Architecture change — and only Julius and Brandon approve that graduation.

---

## Change Control

No changes to this Constitution may be implemented without:

- A documented proposal
- Supporting beta evidence (never a single account or single conversation)
- Review by Julius and Brandon
- Updated version number
