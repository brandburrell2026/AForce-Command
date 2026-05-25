---
name: Recovery Layer phasing
description: Which AForce OS surfaces carry the Recovery Layer feed in which phase. Used to decide whether new recovery wiring belongs in the current phase or a later one.
---

The Recovery Layer is intentionally a hidden engine, not a product. It plugs underneath existing surfaces and never gets its own tab.

**Phase 1 (current — `spec_recovery=false` in prod, `true` in DEMO_ALL_ON)**

- Wired surfaces: Orb, Coach (CommandConsole), Timeline (DB persistence), HydroJournal (reads-only), Social ("RECOVERY LAYER" tiles), Protocol (recovery card), HydroScan (one-line strip).
- Server: `GET /api/aforce/recovery/snapshot` filters rows where `recoveryScore IS NOT NULL`.
- Engine + store bridge covered by Vitest, including explicit guards that no output contains "AI" or "engine".

**Phase 2 (next)**

- Guardian: team recovery + recovery story (no personal data).
- Clutch: pressure / fingerprint / command.
- Both stay flag-gated.

**Phase 3-5**

- Progressive reveal: pressure → fingerprint → identity.

**Why:** The user explicitly classified Guardian + Clutch as Phase 2 work. Do not wire them into Phase 1 even though the original spec listed both as "YES". The MVP loop (Pause → Hydrate → Lock In → Perform) stays user-facing through every phase.

**How to apply:** When asked to "wire Guardian/Clutch recovery", confirm it's a Phase 2 task before starting. When updating the spec PDF or release plan, keep Guardian + Clutch in the Phase 2 row, not Phase 1.
