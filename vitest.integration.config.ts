import { defineConfig } from 'vitest/config';

// Integration-test config — SEPARATE from the fast unit suite (vitest.config.ts).
//
// These tests stand up a real, ephemeral Postgres via Testcontainers (Docker
// required) and are slow, so they are NOT part of the default `vitest` run:
// the unit config only includes files under `__tests__`, which never match the
// `__integration__` glob below. Run on demand / in a Docker-capable CI job:
//
//   pnpm test:integration
export default defineConfig({
  test: {
    include: ['**/__integration__/**/*.integration.test.ts'],
    // Agent worktrees under .claude/ carry full checkouts whose copies of
    // these suites fail on unlinked node_modules — globbing them in makes a
    // green run report phantom failures (observed: "6 files / 26 tests,
    // 6 failed" when the true state was 3/20 green).
    exclude: ['**/node_modules/**', '**/.claude/**'],
    environment: 'node',
    // Container startup (image pull on first run) + DDL needs headroom.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    reporters: 'default',
  },
});
