---
name: vitest react-native transform failures
description: why some aforce-os vitest files fail at load (RN import typeof) and how to tell it apart from a real regression
---

Some aforce-os test files fail at FILE LOAD (not assertion) with:
`RollupError: Parse failure: Expected 'from', got 'typeOf'` at `react-native/index.js` (`import typeof * as ...`).

**What it is:** react-native ships Flow syntax in its entry; the root `vitest.config.ts` has no RN/babel transform, so any test whose import graph pulls in `react-native` (e.g. tests importing components/services that import RN) cannot be transformed and the whole file is reported as a failed test file.

**How to tell it apart from a real failure:** the run summary shows `Test Files N failed` but `Tests M passed (M)` with **zero failed assertions** — the failed files never ran, they failed to load. That is pre-existing environment noise, not a logic regression.

**How to apply:** keep pure logic in RN-free modules (`utils/`, `services/` without RN imports) so it stays unit-testable; put the test under a dir in the vitest `include` globs (`utils/__tests__`, `services/**/__tests__`, `store/__tests__`, `hooks/__tests__` — note `utils/scoring/__tests__` is NOT included). Don't chase the RN `import typeof` RollupError as if your change caused it.
