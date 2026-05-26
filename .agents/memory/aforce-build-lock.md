---
name: AForce FINAL build lock
description: Architecture stance for the aforce-os app — visibility-first, no hiding behind Developer Mode.
---

The previous "Build 100%, Show 10%" stance was reversed by the user. New rule:

**Build once. Evaluate everything. Release later. No hiding.**

**Why:** Internal evaluators (Julius, Brandon) need to see every engine module in context to judge it. Hiding modules behind Developer Mode toggles forced them to either trust the agent's description or hunt deep links. The launcher must be the single source of truth for "what exists."

**How to apply:**
- Every engine module gets a visible entry on the Modules launcher (`/modules`), reachable from Profile without Developer Mode.
- Existing flag gates (`phantom_wearable_enabled`, `spec_cruise`, etc.) stay intact — they encode real hardware/tier constraints — but the launcher surfaces a small "Flag-gated · <flag_name>" tag on the card so evaluators see *why* a tap might redirect.
- Do not introduce new dev-mode-only launchers. Do not remove modules from the list to "tidy up" the UI before release; release-readiness is a copy/polish problem, not a hiding problem.
- Soften language across the app (no "Bad/Dangerous/Toxic/Critical/Emergency"); rename surfaces per the lock spec (Biological → Performance Profile, Recovery Goal → Performance Goal, Field Standard → Traditional Approach, Internal Model → Experimental Internal Model).
