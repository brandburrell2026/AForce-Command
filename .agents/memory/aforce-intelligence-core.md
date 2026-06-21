---
name: AForce Intelligence Core engines pre-exist
description: Reconciliation map before building a "shared command-event ledger"
---

- Before building any "Tier-1 Intelligence Core / shared ledger": the three engines ALREADY EXIST as separate pure, tested utils — `utils/scoring/commandConfidence.ts` (high/med/low from today-behavior + fresh biometrics/weather), `utils/performanceMemory.ts` (streak/energy-trend/recap from voice check-ins), `utils/performanceAge.ts` (+ `services/performanceAgeService.ts`, daily snapshot series). Do NOT rebuild them.
- There is NO unified append-only command-event ledger. Completed behavior is scattered: `UserState.intakeEvents` (rolling 24h), `VoiceCheckInRecord[]`, store `HistoryEntry[]`, transient `confirmationDelta`/`confirmationDeltaSetAt`, `PerformanceAgeDailySnapshot[]`; a `command_followed` event is emitted to `analytics/event_dispatcher.ts` but not persisted as a readable history array.
- Agreed approach (when approved): an additive RN-free pure ledger (`utils/intelligence/commandEvents.ts` + tests) populated from those existing sources via stable dedupe ids, with thin adapter functions mapping ledger→each engine's existing inputs so current signatures/tests stay green. Persistence lives in an app-layer service (AsyncStorage, serialized write queue, merge-by-id, boot-hydration guard) — NOT in the pure util.

**Why:** "Build on a shared event-ledger" reads like greenfield, but rebuilding would duplicate three tested engines and risk Score-Protection regressions.

**How to apply:** Adapter-wrap, don't rewrite. Ledger records only REAL events (no fabrication); absence ⇒ low/needs-more-data, never favorable defaults; ledger and engines stay advisory and never touch score.
