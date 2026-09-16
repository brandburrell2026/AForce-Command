# Testing TODO

Tracked test-infrastructure follow-ups. Tackle in a dedicated testing-infrastructure pass **before any production ship** — not inline, to preserve the one-section-at-a-time cadence.

## Local verification contract

Use Node 22.x and pnpm 11.1.2. Node 22 is now declared in the root
`package.json`, matching the CI workflow and production Docker build. Before a
release candidate, run the following on a machine with Docker available:

1. `pnpm install --frozen-lockfile`
2. `pnpm run typecheck`
3. `pnpm exec vitest run`
4. `pnpm test:integration`

The canonical CI workflows remain the authority for pass/fail status. A local
machine without Node or Docker is not a valid release-verification environment.

- **Contract A rollback (integration).** ✅ IMPLEMENTED — `df86a42d`, `lib/db/src/__integration__/profileRepo.rollback.integration.test.ts` (Testcontainers, both first-mint and recalibration cases). Run via `pnpm test:integration` (Docker required). PENDING: the empirical green run on a Docker-capable machine to close it out.
- **FeatureFlags fixture audit.** ✅ CLOSED — `store/__tests__/_fixtures.ts` now
  includes `healthkit_native_enabled`, `native_tabs_enabled`,
  `native_screens_enabled`, and `secure_store_startup_guard`. The prior
  TS2739 note was stale and must not be treated as an active release failure.
- **Vitest baseline audit.** ✅ CLOSED — on 2026-09-15, the canonical
  no-DB suite completed with **612 passed files / 9,597 passed tests** and 15
  intentionally skipped files. The former Rollup parse-failure and
  missing-`DATABASE_URL` notes were stale; database-backed coverage remains in
  the separate Testcontainers integration lane.
