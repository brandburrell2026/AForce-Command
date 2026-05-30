---
name: aforce-pitch design language
description: Visual + structural conventions for the AForce investor deck (artifacts/aforce-pitch).
---

The deck is an **editorial** investor deck on a **warm grey "paper"** canvas:
the shared `SlideFrame` paints every light slide with a `PAPER_BG` radial
gradient (lighter top-center `#efece6` → `#d6d1c8` lower corners) that mirrors
the lit grey concrete wall behind the figure on slide 7, so all light slides
share that grey-wall mood (the flat cream `#f4f1ea` look was retired at the
user's request — don't revert to flat cream). The `--slide-bg` token is the
grey mid-tone `#e4e0d8` so `bg-bg`/`ring-bg`/`from-bg` elements sit on the same
grey; ink is near-black. **Three-color brand system** (tokens in `index.css`):
**red `--slide-red` `#e41e2b`** = urgency/acquisition/PAUSE, **blue
`--slide-blue` `#2f5bff`** = system/OS/LOCK IN/retention, **black** = body +
HYDRATE/PERFORM. Use `text-blue`/`bg-blue`/`border-blue` for OS/retention
elements, `text-red`/etc. for acquisition/urgency — each color carries fixed
meaning. (Blue was previously collapsed to red; it is now true blue — do not
re-collapse it.) The full 9-color mood board also defines a **neutral ramp**
(charcoal `#1c1f26`, slate `#343a45`, cool-gray `#6b7280`, light-gray `#e5e7eb`,
white `#fff`, cream `#f5f4f1`) — all are CSS tokens consumed via utilities
(`bg-charcoal`/`bg-slate`/`bg-cool-gray`/`bg-light-gray`/`text-cream`); the
cool neutrals live on dark surfaces + chart bars, not on the warm light paper.
**Note:** the Tailwind `black` token is deliberately remapped to brand black
`#0b0d12` (not `#000`), so `bg-black`/`text-black` everywhere (incl. OS phone
mockups) render brand black. The red
`AForce` wordmark sits top-left (no ™ — see `aforce-wordmark.md`), an outline
`Patent-Protected` pill top-right, and a hairline bottom rule carrying the
`CONFIDENTIAL …` note + section/page count. Hero slides may carry warm
documentary photography or the AForce can hero. The deck no longer has a
separate dark "Close" back-cover. **Slide 10 / The Proof Engine** is a
data-forward cream slide (NOT dark cinematic — a full-bleed hooded-athlete
`SlideFrame invert` version was tried and the user rejected it): left column =
eyebrow/headline ("A concentrated / proving ground.") + support + **one
dominant statement** ("Miami. Brickell. One market…") followed by inline
pipe-separated labels (the earlier three stacked proof rows were retired —
don't reintroduce a multi-row list without an ask); right column = an actual
**map of Florida** (public-domain outline path in
`floridaPath.ts`, `FLORIDA_PATH`, viewBox `0 4 70 64`) with a solid **red marker
at Miami/Brickell** (`MIAMI = {x:60.4, y:56.2}`) + a pulsing red halo, and a
"Miami · Brickell / The beachhead" caption below. (An earlier phyllotaxis
dots-into-glowing-core graphic was replaced by the user's request for a real
map.) Don't revert it to the abstract graphic, bare text, or the dark photo
version without an ask.

**Type system: Inter for everything.** Both `--font-display-family` and
`--font-body-family` in `index.css` are Inter. **Why:** a high-contrast
serif (Bodoni Moda) magazine treatment was tried for display and the user
**rejected it — change the font back to Inter**. Do not reintroduce a serif
display face without an explicit ask. **Serif gotcha (if ever revisited):**
high-contrast Bodoni renders em-dashes/hyphens as near-invisible hairlines in
running text, and negative letter-tracking collapses serif glyphs — so a serif
display would force Inter for all prose/chrome and positive tracking on big
figures. Not worth it given the rejection.

**Per-slide rule:** ONE headline + ONE supporting thought + ONE image/chart,
with massive whitespace. One emphasis word per H1 in red or blue.

**Why:** the user approved a full rebuild into a new narrative per investor
(Peter & Kristel) feedback. Numbers are intentionally illustrative and labeled
"illustrative"; capital raise is $4M.

**How to apply:**
- The deck ends on "The Ask" (no dark back-cover slide). Sections live in
  `SlideChrome.tsx` (Stakes / Opportunity / System / Team / Plan). Keep
  `SECTIONS` ranges contiguous (no gaps) so `sectionFor()` never returns
  undefined, keep `TOTAL_SLIDES === manifest length`, and keep `BG_NAMES`
  length === slide count. **Changing slide count means touching 4 places in
  lockstep: manifest, `TOTAL_SLIDES`, `SECTIONS` ranges, `BG_NAMES`, plus the
  `ambientTrackFor` act ranges in `App.tsx`** — stale ranges break silently.
- Slides live in `src/pages/slides/*.tsx`, registered in
  `src/data/slides-manifest.json` (strict Zod), eager-globbed by
  `slideLoader.ts`. Run `pnpm --filter @workspace/aforce-pitch run
  validate-slides` after manifest changes.
- Shared chrome is `SlideFrame.tsx` (supports `invert` for black slides);
  `EditorialSlide.tsx` is the photo-split single-support-line layout.
- `ambientTrackFor` in `App.tsx` maps slides to audio acts — keep ranges in
  lockstep with slide-count changes. Stale ranges break silently after a cut.
- Motion policy: the intro splash sound-gate and global slide
  entrance/transition animations stay removed — do not reintroduce a gate or
  blanket slide transitions without an explicit ask. **Per-slide** framer-motion
  is allowed when the user explicitly asks to make a slide "more dynamic" (e.g.
  ThePrize / slide 4 has count-up + staggered bar-growth). Any such motion must
  gate every entrance/loop behind `useReducedMotion()` so reduced-motion users see
  the final resting state (count-up/glow/bars and all fade/slide reveals disabled).
- **Export = static, live = animated.** Slides import `useReducedMotion` from the
  local wrapper `src/lib/useReducedMotion.ts` (NOT directly from framer-motion).
  The wrapper returns `true` when the system prefers reduced motion OR when
  `window.location.pathname` ends with `/allslides` (the headless PDF/PPTX export
  route), else `false`. **Why:** the user wanted exports fully static while the
  live `/slideN` presentation keeps its animations. **How to apply:** any NEW
  animated slide must import `useReducedMotion` from this wrapper and gate every
  entrance + `repeat: Infinity` loop on `reduce`, or it will animate mid-capture
  during export.
- Google Fonts `@import` must come *before* `@import "tailwindcss"` in
  `index.css` or the production CSS parser drops the font import.
