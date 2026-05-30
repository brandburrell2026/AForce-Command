---
name: AForce can product image duplication
description: The flavor can PNGs are duplicated across artifacts; keep them in sync when fixing label artwork.
---

The three AForce flavor can renders (Berry Blast, Soursop Edge, Watermelon
Surge) are **duplicated across artifacts** as separate PNG files that are the
same underlying artwork, exported at different crops/sizes:

- `artifacts/aforce-pitch/public/can-{berry,soursop,watermelon}.png` — 4000x4000
  transparent **canonical master** (this is the set that gets label-text fixes
  first).
- `artifacts/aforce-pitch/public/images/products/can-{...}.png` — 1321x3116
  **portrait** crop used by the WhiteSpace slide (slide 6); needs transparency +
  that aspect preserved (WhiteSpace adds its own reflection/drop-shadow).
- `artifacts/aforce-site/src/assets/products/can-{...}.png` — 4000x4000, used by
  the marketing-site Home hero.
- `artifacts/aforce-os/assets/images/products/can_{...}_v2.png` (+ the watermelon
  `can_watermelon.png`) — 4000x4000, the mobile app's displayed product cans
  (`data/products.ts` `can:` fields point at the `_v2` set).

**Why:** a label typo ("Perfomance" → "Performance") had been fixed only on the
pitch-public master, leaving the other copies stale. They are visually the same
render (global RMSE ~1–3% vs the master, difference localized to the text), so
the cheapest lossless fix is to **copy the corrected master over the square
copies** and **reconstruct the portrait copies** from the master
(`magick MASTER -trim +repage -resize x3116 -background none -gravity center
-extent 1321x3116 DST`) rather than re-running lossy/non-deterministic AI image
edits (which also downscale 4000px → ≤1536px and can't hold the 0.42 portrait
aspect).

**How to apply:** any future label/artwork change to a can must be propagated to
ALL four locations above or copies drift. The abstract single-can hero images
(`public/images/hero-can.png`, `public/images/aforce-can.png`,
`aforce-site/.../drink-can-hero.png`) carry NO flavor footer text, so they are
unaffected by label-text fixes. The unused non-`_v2`
`aforce-os/.../can_{berry,soursop}.png` are not referenced anywhere.
