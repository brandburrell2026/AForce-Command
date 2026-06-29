# Testing TODO

Tracked test-infrastructure follow-ups. Tackle in a dedicated testing-infrastructure pass **after Part A, before any production ship** — not inline, to preserve the one-section-at-a-time cadence.

- **Contract A rollback (integration).** Force WRITE 5 in `recordMajorChange` (`lib/db/src/profileRepo.ts`) to throw against a real/throwaway Postgres, assert WRITES 1–4 leave no rows — proves the Adaptive Profile Engine™ mint transaction rolls back atomically (Contract A) empirically, not just by inspection. Needs a disposable Postgres in the test env (the in-memory repo can't simulate a mid-transaction crash).
- **`_fixtures.ts:92` FeatureFlags fixture missing 4 newer flags** (`healthkit_native_enabled`, `native_tabs_enabled`, `native_screens_enabled`, `secure_store_startup_guard`) — fails `aforce-os` `tsc --noEmit` (TS2739). Pre-existing, unrelated to Part A; fix in a separate pass (add the 4 keys as `false`).
