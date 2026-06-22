---
name: AForce Investor Demo (Phase 10) — spec supersession & test globs
description: Non-obvious decisions for the demo_mode_enabled investor overlay — where the FINAL_SPEC is intentionally overridden, and a vitest glob gotcha for pure tests.
---

# AForce Investor Demo Overlay — durable gotchas

## AFORCE_FINAL_SPEC Phase 10 wording is intentionally superseded

The spec text says Act 1 "fades in **gold**" and Act 2 "**lime** glow intensifies",
and the Hard Rules say it "auto-dismisses … and returns to `welcome.tsx`".
**All three are stale and must NOT be re-introduced.**

- **No gold / no lime.** The overlay uses the AForce brand re-skin: brand red
  `#C1281B` + the WHOOP recovery state colors (PEAK/BALANCED/RECOVERING/DEPLETED).
  The whole app dropped lime/gold in the re-skin.
- **No `welcome.tsx`.** That screen was removed; home is `app/(tabs)/index.tsx`.
  The demo is a `Modal` overlay — closing it simply reveals whatever the app
  routed to underneath. That IS the "return".

**Why:** the spec predates the brand re-skin and the welcome-screen removal. A
future agent "fixing the demo to match the spec" would regress the brand and
hunt a file that doesn't exist.
**How to apply:** treat the brand re-skin + current routing as the source of
truth over the spec's color/route wording. The architect explicitly endorsed
the 6-act-from-seed rewrite over the legacy 10-beat voice script.

## Root vitest globs don't cover `data/` or `featureFlags/` by default

`vitest.config.ts` `test.include` only lists aforce-os `services/`, `utils/`,
`store/`, `hooks/` `__tests__` dirs. A pure test placed under
`artifacts/aforce-os/data/**/__tests__/` or `featureFlags/**/__tests__/` is
**silently not collected** until you add its glob to `include`.

**Why:** lost ~a debugging cycle wondering why new seed/flag tests "passed" (they
never ran). Adding the two globs is safe — no other test dirs exist there.
**How to apply:** when adding pure tests for a new top-level module dir, confirm
a matching `include` glob exists first, or co-locate under an already-covered dir
(e.g. `services/__tests__/`).
