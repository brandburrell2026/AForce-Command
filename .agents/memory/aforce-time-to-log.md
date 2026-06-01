---
name: AForce Time-To-Log (passive logging) KPI
description: How the hydration "Time To Log" friction metric is defined and why it is measured/recorded the way it is.
---

# Time-To-Log (TTL) — passive logging KPI

TTL is a **client-side friction metric**: how long from the logging surface
becoming active to the user's tap. It is NOT a server round-trip timer.

**Rules (keep consistent):**
- Anchor = when the surface is interactable. Re-anchor on screen focus
  (expo-router `useFocusEffect`) and reset after every log, so backgrounded /
  tab-away time never inflates the median.
- Record TTL **at tap time**, deliberately before the intake write resolves.
  This measures user effort, not network latency. A failed write still counts
  as an attempt — accepted tradeoff for a friction KPI.
- Derivation stays **pure** (no `Date.now()` in the derive function); only the
  component/service touch the clock and append events.
- Metric block exposes count, median (even count = mean of two middles),
  under-2s rate; missing/negative ttl is ignored.

**Why:** the product KPI is "log in under 2 seconds" = friction the user feels.
Conflating it with server latency would make a fast UI look slow on bad networks.

**How to apply:** if you extend logging surfaces (widgets, voice, wearable),
keep the same surface-active→tap semantic and the same metric block so medians
stay comparable. If a future ask needs *success-only* counts, add a success
flag rather than moving the anchor past the write.

**Build-lock note:** the surface ships as an additive home row with NO feature
flag that self-hides when empty — mirroring the DailyWinBanner precedent.
spec_uiFreeze forbids redesign/move/rebuild of frozen surfaces but allows
additive components.
