---
name: aforce-os vitest full-suite RN parse failures
description: Why `npx vitest run artifacts/aforce-os` shows ~13 failed test FILES that are not regressions, and how to verify pure tests instead.
---

Running the full `npx vitest run artifacts/aforce-os` suite reports a batch of *failed test files* (e.g. profileSource, recoveryCircle, sharedContextLayer, sleepStateMachine, socialState, timelineLock, uiFreeze, and others) with an identical error:

`RollupError: Parse failure: Expected 'from', got 'typeOf'` at `react-native/index.js:27` (`import typeof * as ReactNativePublicAPI ...`).

**What this is:** Vite/Rollup's SSR transform cannot parse react-native's Flow `import typeof` syntax. Any test file whose module graph *transitively* imports `react-native` (usually via `@/store/useAppStore` or a service that touches AsyncStorage/expo) fails to **load** — it is a parse/load failure, NOT a test assertion failure. The actual assertions (1283+) all pass.

**Why it is not a regression:** the failing set includes files no current task touched, and reproduces on an untouched file (`uiFreeze.test.ts`) by itself. It is a pre-existing environmental limitation of the test harness.

**How to apply:**
- Verify pure logic by running the specific pure test files by full path, e.g. `npx vitest run artifacts/aforce-os/utils/__tests__/<x>.test.ts artifacts/aforce-os/services/__tests__/<y>.test.ts`. Pure engine/selector/service-mapping tests deliberately avoid importing react-native and run clean.
- Keep new unit tests pure (no RN import) so they load under vitest.
- Do NOT chase the `import typeof` error as a bug in your change; confirm scope by reproducing on a file you did not touch before concluding anything.
