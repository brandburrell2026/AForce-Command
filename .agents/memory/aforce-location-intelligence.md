---
name: AForce Location Intelligence surfacing
description: How Location Intelligence's two home surfaces split responsibility, and the locale rule that bit a code review.
---

Location Intelligence surfaces on the home screen through TWO distinct banners, by design — keep them separate:

- **Ambient environmental insight** (altitude / UV / air quality / heat+humidity note) → its own flag-gated banner that self-hides when the feature flag is off (home stays byte-identical).
- **Travel advisory** → owned by the Smart Modes "travel" mode, rendered by the Smart Modes banner. Do **NOT** add a second travel banner or surface travel in the ambient banner — that double-surfaces travel.

**Localization is part of "done", not a follow-up.** The pure Smart Modes engine holds only English fallback copy; a code review REJECTED the task because the visible guidance/labels weren't translated. The fix pattern: the pure engine exposes stable i18n *keys*, and the banner resolves them with `t(key, { defaultValue })`. Travel reuses the shared Location Intelligence travel-advisory key so the copy lives in one place. Launch locales (en/es/fr/de/pt/it) must carry the keys; hidden locales fall back to English via `fallbackLng`.

**Score-Protection:** the environmental hydration adder is target-side and advisory only (never touches score). It is computed + tested but not yet surfaced on any screen.

**Why:** the spec asked for an insight note AND a travel banner, but travel was already wired through Smart Modes — so the only genuinely new ambient surface is the insight note, and travel work goes through Smart Modes.
