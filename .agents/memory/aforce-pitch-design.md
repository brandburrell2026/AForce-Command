---
name: aforce-pitch design language
description: Visual + structural conventions for the AForce investor deck (artifacts/aforce-pitch).
---

The deck is 15 slides in "Documentary Warm + Scandinavian discipline":
cream paper `#f4f1ea`, charcoal ink `#2d2a26`, Cormorant Garamond display
(use italic on a single emphasis word per headline), Inter for tiny
all-caps tracked labels, hairline rules, generous whitespace, warm
desaturated documentary photography on hero slides only.

**Why:** the user picked this direction after seeing three canvas variants
(Editorial / Scandi / Documentary) and explicitly asked to blend
Documentary Warm's emotional warmth with Scandinavian typographic
restraint. Mood target: Nike restraint + Apple simplicity + WHOOP
behavioral intelligence + Scandinavian calm.

**How to apply:**
- Slide count is locked at 15. Any new content goes in an existing slot,
  not as a new slide, unless the user explicitly asks to expand.
- Photo treatment: `filter: saturate(0.45-0.55) contrast(1.05-1.08) sepia(0.16-0.22)`.
- Hero photos: Cover (1), Silence (3), Founders (11), Final (15). Other
  slides are type-driven.
- `ambientTrackFor` in `App.tsx` maps slides to 4 audio acts — keep the
  ranges in lockstep with slide-count changes (currently 1-3 / 4-7 /
  8-13 / 14-15). Old 31-slide ranges broke silently after the cut.
- Google Fonts `@import` must come *before* `@import "tailwindcss"` in
  `index.css` or the production CSS parser drops the font import.
