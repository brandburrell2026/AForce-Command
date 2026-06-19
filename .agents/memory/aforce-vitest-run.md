---
name: AForce running vitest
description: How to actually run aforce-os tests — the include globs are workspace-root-relative, so per-package invocation fails.
---

# Running aforce-os (and sibling) vitest suites

The vitest `include` globs are **workspace-root-relative**
(`artifacts/aforce-os/services/**/__tests__/**`, `.../utils/__tests__/**`,
`.../store/__tests__/**`, `.../hooks/__tests__/**`, plus api-server / aforce-site).

- **Run from the repo root**, e.g. `npx vitest run <substring>`. Filters are matched
  as substrings against the full file path, so `npx vitest run signalHierarchy
  hydrationDemandAdapter store/__tests__` works.
- **Do NOT** use `pnpm --filter @workspace/aforce-os exec vitest …` or `--dir
  artifacts/aforce-os/store` — the cwd/dir no longer lines up with the root-relative
  include globs and vitest reports "No test files found".
- Pure-engine tests must live in `utils/__tests__/` (and services in
  `services/__tests__/`); nested `utils/<sub>/__tests__` is NOT covered by include.
- The full `artifacts/aforce-os` run is slow/noisy because ~a dozen RN files fail to
  parse (`import typeof`) at file-load — pre-existing, not regressions. Prefer
  targeted substring runs to verify your change.
