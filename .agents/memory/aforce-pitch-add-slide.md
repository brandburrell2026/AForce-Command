---
name: aforce-pitch adding a slide
description: The cross-file wiring required to add/remove a slide in the aforce-pitch deck
---

Slide bodies auto-load from `src/data/slides-manifest.json` via `slideLoader.ts`
(`import.meta.glob` over `src/pages/slides/*.tsx`, sorted by `position`). So a new
slide component only renders if it has a manifest entry pointing at its filepath.

**But the page count and section label are NOT derived from the manifest.** They
live as hardcoded constants in `src/components/SlideChrome.tsx`:
- `TOTAL_SLIDES` (the "/ NN" in every footer) — bump it by hand.
- `SECTIONS` (range-based) — extend an existing range or add a new
  `{ name, range: [n, n] }`; `sectionFor()` falls back to section 1 if a slide
  number isn't covered, so a missing range silently mislabels the footer.

**Why:** the manifest drives which components mount, but chrome counts/sections
are separate literals. Forgetting them makes a new slide render with a wrong
"X / 17" count or the wrong section name.

**How to apply:** to add a slide you touch FOUR things — create the
`src/pages/slides/*.tsx`, add the manifest entry (unique id, contiguous
position), bump `TOTAL_SLIDES`, and cover the new position in `SECTIONS`. Then
`pnpm run validate-slides` + `pnpm run typecheck`.

Note: `BG_NAMES` in SlideChrome is only used by the legacy `SlideChrome`
background plate, NOT by `SlideFrame` (which most current slides use), so a
SlideFrame-based slide does not need a BG_NAMES entry.
