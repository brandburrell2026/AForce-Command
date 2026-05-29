---
name: aforce-pitch design language
description: Visual + structural conventions for the AForce investor deck (artifacts/aforce-pitch).
---

The deck is a **14-slide editorial** investor deck in a luxury-restraint
magazine language: cream paper `#f4f1ea`, near-black ink, **red `#e41e2b`**
and **blue `#2f5bff`** accent colors, Inter for display. The red `AForce`
wordmark sits top-left (no ™ — see `aforce-wordmark.md`), an outline
`Patent-Protected` pill top-right, and a hairline bottom rule carrying the
`CONFIDENTIAL …` note + section/page count. Hero slides may carry warm
documentary photography or the AForce can hero.

**Per-slide rule:** ONE headline + ONE supporting thought + ONE image/chart,
with massive whitespace. One emphasis word per H1 in red or blue.

**Why:** the user approved a full rebuild from the prior 15-slide structure
into a new 14-slide narrative per investor (Peter & Kristel) feedback.
Numbers are intentionally illustrative and labeled "illustrative"; capital
raise is $4M.

**How to apply:**
- Slide count is 14. Sections in `SlideChrome.tsx`: Stakes 1-3, Opportunity
  4-6, System 7-9, Team 10-11, Plan 12-14. Keep `SECTIONS` ranges contiguous
  (no gaps) so `sectionFor()` never returns undefined, and keep
  `TOTAL_SLIDES === manifest length`.
- Slides live in `src/pages/slides/*.tsx`, registered in
  `src/data/slides-manifest.json` (strict Zod), eager-globbed by
  `slideLoader.ts`. Run `pnpm --filter @workspace/aforce-pitch run
  validate-slides` after manifest changes.
- Shared chrome is `SlideFrame.tsx` (supports `invert` for black slides);
  `EditorialSlide.tsx` is the photo-split single-support-line layout.
- `ambientTrackFor` in `App.tsx` maps slides to audio acts — keep ranges in
  lockstep with slide-count changes. Stale ranges break silently after a cut.
- Slides render statically (no framer-motion). Per user request the intro
  splash sound-gate and all slide entrance/transition animations were removed;
  do not reintroduce motion or a gate without an explicit ask.
- Google Fonts `@import` must come *before* `@import "tailwindcss"` in
  `index.css` or the production CSS parser drops the font import.
