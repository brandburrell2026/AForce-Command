---
name: aforce-pitch design language
description: Visual + structural conventions for the AForce investor deck (artifacts/aforce-pitch).
---

The deck is 15 slides in a **bold magazine** language (Wallpaper / i-D /
the AForce executive-summary reference): cream paper `#f4f1ea`, near-
black ink `#1a1815`, **red `#e53341`** and **blue `#2d4a8a`** accent
colors, Inter at weight 900 for display, Inter 500/uppercase/tracked
`0.28-0.32em` for tiny eyebrows. The red `AForce™` wordmark sits top-
left, `INVESTOR DECK · PHASE 1 · PROOF OF CONCEPT` + red outline
`PATENT-PROTECTED` pill sit top-right, `CONFIDENTIAL …` + the bold
`Before America's real deal we build proof. After, we build scale.`
statement sit bottom on a hairline. Hero slides may carry warm
desaturated documentary photography or the AForce can hero.

**Why:** the user rejected the earlier Cormorant Garamond /
Scandinavian-quiet cut and shared a screenshot of their original
"executive summary" slide, asking for "high fashion magazine" — bold
sans, colored accent words (red `performance`, red/black/blue/black
`Pause. Hydrate. Lock in. Perform.`), AForce red wordmark, magazine
chrome, product hero photography. Headline rule: **one** emphasis word
per H1 in red (or blue) for contrast against the deep ink.

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
