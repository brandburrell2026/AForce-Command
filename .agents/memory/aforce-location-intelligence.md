---
name: AForce Location Intelligence surfacing
description: How Location Intelligence's two home surfaces split responsibility, and the locale rule that bit a code review.
---

Location Intelligence surfaces on the home screen through TWO distinct banners, by design — keep them separate:

- **Ambient environmental insight** (altitude / UV / air quality / heat+humidity note) → its own flag-gated banner that self-hides when the feature flag is off (home stays byte-identical).
- **Travel advisory** → owned by the Smart Modes "travel" mode, rendered by the Smart Modes banner. Do **NOT** add a second travel banner or surface travel in the ambient banner — that double-surfaces travel.

**Localization is part of "done", not a follow-up.** The pure Smart Modes engine holds only English fallback copy; a code review REJECTED the task because the visible guidance/labels weren't translated. The fix pattern: the pure engine exposes stable i18n *keys*, and the banner resolves them with `t(key, { defaultValue })`. Travel reuses the shared Location Intelligence travel-advisory key so the copy lives in one place. Launch locales (en/es/fr/de/pt/it) must carry the keys; hidden locales fall back to English via `fallbackLng`.

**Score-Protection + no-fabrication:** the environmental hydration adder is target-side and advisory only (never touches score). It now surfaces on the Home daily target as a READ-ONLY display projection (HydrationStatusCard target number + caption), layered on the SERVER-AUTHORITATIVE target — it never mutates `userState.dailyTarget` / reducer / realApi / server. TWO hard gates, not one: (1) the feature flag, AND (2) the snapshot **source must be `'live'`**. `getLocationSnapshot()` falls back to deterministic MOCK inputs (Denver/Miami, `source:'mock'`) on permission/network/native failure; honoring a mock reading on a user-visible target FABRICATES the user's environment (a code review caught exactly this). Gate the adder behind `locationCanAdjustTarget(enabled, source)` — checking the flag alone is not enough.

**Score-Protection guards the SCORE, not the advisory daily TARGET.** A code review REJECTED the wiring because air quality had been excluded from the environmental water adder, citing "Score-Protection: advisory only" — but the demand adder is target-side and never touches score, so that was an over-application that also violated the owner's acceptance criterion ("hotter/more humid/higher-altitude/**worse-air** conditions raise the recommended target by a sensible, capped amount"). Fix: `calculateLocationDemandAdderOz` = altitude + UV + a modest air-quality bump (good/moderate 0, sensitive 1, unhealthy 2, hazardous 3), still clamped to `LOCATION_DEMAND_CAP_OZ`. **Why:** don't suppress an owner-requested *target* adjustment by invoking Score-Protection — that lock is about the score, and the advisory target is a separate, display-only number.

**Why:** the spec asked for an insight note AND a travel banner, but travel was already wired through Smart Modes — so the only genuinely new ambient surface is the insight note, and travel work goes through Smart Modes.
