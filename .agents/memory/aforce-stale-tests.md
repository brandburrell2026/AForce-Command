---
name: AForce known pre-existing test failures
description: Tests that already fail on main independent of your change — don't treat as your regression.
---

# Pre-existing failing tests in aforce-os

- `store/__tests__/slice.units.test.ts` — 4 failures. The suite predates a `height`
  unit preference that was later added to `utils/units.ts` + `DEFAULT_UNIT_PREFERENCES`.
  The test still asserts the old shape (e.g. line ~29 expects `{weight,temperature,volume}`
  with NO `height`, while line ~51 expects `height:'ft'`), so `sanitizeUnitPreferences`
  now injects a `height` default the older assertions don't expect.

**Why:** confirmed during the Phase 6 god-file refactor — `units.ts`, `appStoreReducer.ts`,
and the test itself were all unmodified by that work, yet these 4 fail. The test imports only
from `appStoreReducer`, `utils/units`, and `_fixtures` (not from the store provider), so its
result is independent of store/scoring refactors.

**How to apply:** if you see these 4 `slice.units` failures, they are stale-test debt, not a
regression you introduced. Fix only if you're explicitly asked to update the units test to the
current `height`-aware shape (out of scope for behavior-preserving refactors).
