---
name: aforce-pitch / aforce-friends-family adding a slide
description: The cross-file wiring required to add/remove/reorder a slide in the aforce-pitch AND aforce-friends-family decks (identical chrome architecture)
---

Applies identically to BOTH `artifacts/aforce-pitch` and `artifacts/aforce-friends-family`:
same `slideLoader.ts` + manifest `position` + hardcoded `SlideFrame slide={N}` +
hardcoded `SlideChrome.tsx` `TOTAL_SLIDES`/`SECTIONS`. Treat the rules below as
deck-agnostic.

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

**How to apply:** to add a slide you touch FOUR functional things — create the
`src/pages/slides/*.tsx` (with the correct hardcoded `slide={N}`), add the
manifest entry (unique id, contiguous position), bump `TOTAL_SLIDES`, and cover
the new position in `SECTIONS`. Then `pnpm run validate-slides` +
`pnpm run typecheck`. **Inserting mid-deck** (not appending) = the reorder rule
applied to a range: every slide AFTER the insertion point must have BOTH its
manifest `position` AND its `<SlideFrame slide={N}>` literal bumped +1, and the
shifted `SECTIONS` ranges adjusted. Also hand-sync `SLIDE-GUIDE.md` (the
human-readable speaker-notes map: the "(NN slides)" count, the section/slide-range
table, the inserted `### Slide N — …` entry, and the renumbered later headings) —
it is doc-only (nothing validates it) so it drifts silently if skipped.

Note: `BG_NAMES` in SlideChrome is only used by the legacy `SlideChrome`
background plate, NOT by `SlideFrame` (which most current slides use), so a
SlideFrame-based slide does not need a BG_NAMES entry.

**Reordering a slide takes TWO edits, not one.** The manifest `position` only
controls deck *order* (slideLoader sorts by it). But every slide component
hardcodes its own number via `<SlideFrame slide={N}>` (e.g. RealDeal.tsx,
TheFounders.tsx), and that prop — not the manifest — drives the footer "NN / 24"
counter, the section eyebrow (`sectionFor`), and the legacy bg slug. **Why:**
changing only the manifest position reorders the slides but leaves each slide
showing its OLD footer number/section → off-by-one drift that typecheck and
validate-slides both pass silently. **How to apply:** when you move a slide,
update its manifest `position` AND the `slide={N}` literal inside the slide's
component, keeping them equal; verify by screenshotting the moved slides.

**Removing a slide is the reorder problem at scale, plus two extras.** Deleting
slide K means: drop its manifest entry, then decrement BOTH the `position` and the
hardcoded `slide={N}` literal by 1 for EVERY slide after K (positions must stay
contiguous — `validateContiguousPositions`), decrement `TOTAL_SLIDES`, and shift the
affected `SECTIONS` ranges. Also DELETE the slide's `.tsx` file —
`validateOrphanedSlideFiles` fails on any `*.tsx` in `pages/slides/` not referenced
by the manifest (note: `.ts` helpers like `floridaPath.ts` are exempt). **Why:** a
deck has ~24 slides each hardcoding its own number, so one removal touches ~16 files;
miss the `slide={N}` edits and every later footer is off-by-one (passes typecheck +
validate-slides silently). **How to apply:** screenshot a late slide to confirm the
footer "NN / total" and section eyebrow line up.

**Manifest `description` (and `title`) are unvalidated free-text metadata.**
`validate-slides` only checks structure (unique/contiguous positions, filepaths
resolve) — it does NOT compare descriptions against rendered slide copy. So when
you change a slide's body (chains, headlines, metrics, eyebrows), the manifest
description silently drifts and will contradict the slide. **Why:** a stale
description survives validate-slides + typecheck and only surfaces in a careful
read/diff. **How to apply:** whenever you edit slide copy, hand-sync that slide's
manifest `description`/`title` in the same change.
