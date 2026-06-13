---
name: AForce product image padding vs slide layout
description: Why bg-removed / AI-generated product PNGs sit wrong in the pitch product-stage layout, and the fix.
---

## bg-removed and AI-generated product shots come padded; trim before layout
`remove_image_background_tool` output and `generateImage` output are square/large frames
(e.g. 4000x4000 can, 768x1408 stick) with the product centered inside lots of transparent
margin. The pitch product-stage layout (TheRitual / TheRitualV2) positions art with
`left:%` + `height:Nvh` + `w-auto object-contain`, tuned for the ORIGINAL tightly-cropped
PNGs (cans ~1321x3116, sticks ~890x3435). Dropping a padded PNG in at the same coords makes
the element box huge, so the visible product is pushed off-center / off the right edge and
looks undersized.

**Why:** object-contain sizes the element by the image's intrinsic ratio, not the visible
subject; transparent padding inflates that box.

**How to apply:** after bg-removal/generation, trim transparent borders so the PNG bounding
box hugs the product before referencing it in a tight-crop layout:
`magick in.png -trim +repage out.png` (note: IMv7 — use `magick`, `convert` is deprecated;
only `magick/identify` are reliably on PATH). Then the existing left/height values just work.

## A single horizontal stick hero photo can't fill the slide-9 vertical back-row
The real AForce stick product photo is ONE wide horizontal pouch shot with the soursop fruit
+ water splash attached on the left/top. The TheRitual product stage expects 3 vertical
back-row sticks standing behind the cans. You cannot synthesize 3 vertical sticks from this
one horizontal asset, and a clean rectangular crop can't fully separate pouch from fruit
(they overlap at the left crimp).

**Why:** asset orientation/count mismatch; cropping the fruit off squares the pouch ends and
clips the pH badge if you go too tight.

**How to apply:** crop to just the silver pouch body (`magick stick.png -crop WxH+X+Y +repage
-trim +repage`, iterate X/Y by eye via the read tool) and FLOAT it softly above the can
lineup (small width, low blur) instead of wedging it in the back row where the cans occlude
it into an unreadable blob. For true slide-9 parity, ask the user for vertical per-flavor
stick photos — don't fabricate them.
