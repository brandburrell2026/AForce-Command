---
name: AForce Intelligence Core ledger + adapters
description: Shared command-event ledger design — engines pre-exist; unify via additive adapters; durable concurrency + day-index constraints
---

- The three Tier-1 engines ALREADY EXIST as separate pure, tested utils (Command Confidence = high/med/low from today-behavior + fresh biometrics/weather; Performance Memory = streak/energy-trend from voice check-ins; Performance Age = daily snapshot series). Do NOT rebuild them. Real completed behavior is otherwise scattered (rolling-24h intake events, voice check-in records, store history, transient command-confirmation, perf-age snapshots).
- Unify via an ADDITIVE, RN-free pure ledger + thin adapters that map ledger→each engine's EXISTING input shape, so engine signatures/tests stay green. Persistence is an app-layer AsyncStorage service, never in the pure util.

**Why:** "Build on a shared event-ledger" reads like greenfield, but rebuilding would duplicate three tested engines and risk Score-Protection regressions.

**How to apply (durable constraints):**
- Adapter-wrap, don't rewrite. Ledger records only REAL events (no fabrication); absence ⇒ low/needs-more-data, never favorable defaults. Score-Protection isolation: the ledger/adapters/service are advisory only and must NEVER dispatch a reducer action or touch score. No live wiring into reducer/screens without explicit owner approval.
- Day-index convention DIFFERS per source and MUST be preserved round-trip: voice check-ins carry the record's LOCAL-calendar dayIndex (what streak math compares to now); performance-age snapshots carry the UTC day index floor(ms/86400000). Don't normalize them to one convention — each consumer relies on its own.
- Stable dedupe ids make re-derivation idempotent under the ledger's first-wins merge: voice id embeds completedAtMs so a same-day re-check-in is a distinct event (Performance Memory keeps latest per day); perf-age id is the day index (one frozen daily snapshot); confirmation id appends commandId when present.
- The "adherence" learning read is deliberately NOT fed into Command Confidence — wiring it would let follow-rate silently upgrade confidence (Score-Protection breach). Keep it a separate read-only primitive.
- Persistence concurrency (mirrors hydroScanHistory service): an append must update memory but DEFER its storage write until after boot-hydration has read original storage — never force hydrated=true on append, or a pre-hydration append clobbers stored history before it is merged. clear() must bump a generation counter (and null the in-flight hydrate promise) so a late hydrate abandons its merge and cannot resurrect cleared events.
