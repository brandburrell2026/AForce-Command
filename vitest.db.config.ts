import { defineConfig } from 'vitest/config';
import path from 'node:path';

// DB lane — real-Postgres suites carved out of the unit lane (Wave-4).
//
// These nine api-server suites execute genuine Drizzle queries against the
// DATABASE_URL database and fail in the unit lane with 'Failed query' /
// ECONNREFUSED (vitest.setup.ts's placeholder URL never connects). Each file
// is guarded with `describe.runIf(Boolean(process.env['DB_TESTS']))`, so:
//
//   - unit lane (vitest.config.ts): DB_TESTS unset -> suites SKIP, never fail
//   - DB lane:   pnpm test:db  (DB_TESTS=1 vitest run --config vitest.db.config.ts)
//     with DATABASE_URL pointing at a real Postgres whose schema has been
//     applied (`pnpm --filter @workspace/db push-force`). CI provides a
//     postgres:16 service container in the `db-lane` job (.github/workflows/ci.yml).
//
// This lane is DISTINCT from vitest.integration.config.ts (Testcontainers,
// `__integration__/*.integration.test.ts` — self-provisioning Docker): here the
// caller supplies the database via DATABASE_URL.
export default defineConfig({
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.webp'],
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    // Mirrors vitest.config.ts so module resolution is identical in both
    // lanes (none of the nine suites currently exercise these aliases, but
    // parity keeps a future import from behaving differently per-lane).
    alias: [
      {
        find: /^(.*\/)?data\/products$/,
        replacement: path.resolve(__dirname, 'artifacts/aforce-os/data/products.node-stub.ts'),
      },
      { find: /^@\//, replacement: path.resolve(__dirname, 'artifacts/aforce-os') + '/' },
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    // EXACTLY the DB-dependent suites — explicit file list, no globs, so the
    // lane's scope is auditable at a glance and can't silently grow.
    include: [
      'artifacts/api-server/src/__tests__/scanRepo.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/whoopAdvisoryLock.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/whoopAuthStateStore.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/whoopFetchWorker.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/whoopTokenStore.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/whoopTokenUserIds.drizzle.test.ts',
      'artifacts/api-server/src/__tests__/scansRoute.test.ts',
      'artifacts/api-server/src/routes/__tests__/earlyAccess.test.ts',
      'artifacts/api-server/src/routes/aforce/__tests__/intake.test.ts',
    ],
    // Same phantom-checkout protection as vitest.integration.config.ts.
    exclude: ['**/node_modules/**', '**/.claude/**'],
    environment: 'node',
    // Suites share one database; parallel files would race each other's
    // seed/cleanup rows (they use fixed test-user prefixes, not per-run ids).
    fileParallelism: false,
    reporters: 'default',
  },
});
