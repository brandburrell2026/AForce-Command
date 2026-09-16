import { defineConfig } from 'vitest/config';

import dbConfig from './vitest.db.config';

// Benchmark lane — the Phase C harness, and nothing else.
//
// Deliberately NOT added to vitest.db.config.ts's include list. That list is
// explicit so the DB lane's scope is auditable at a glance, and the benchmark
// seeds 500 athletes per size: it would add minutes to every CI run to
// measure something CI has no stable timing environment for anyway.
//
// Resolution, setup and the DATABASE_URL requirement are inherited from the
// DB lane, so the harness runs against exactly the database that lane does.
// `include` is REPLACED rather than merged — mergeConfig concatenates arrays,
// which would have run the whole DB lane alongside the benchmark.
//
//   pnpm bench:trainer-board
export default defineConfig({
  ...dbConfig,
  test: {
    ...dbConfig.test,
    include: ['artifacts/api-server/src/__tests__/trainerBoardBench.drizzle.test.ts'],
    // One roster at a time. Parallel sizes would contend for the same pool
    // and the latency numbers would measure the contention.
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
