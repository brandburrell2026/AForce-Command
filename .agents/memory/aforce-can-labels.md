---
name: AForce can label text is baked into the PNGs
description: How to correct text on the aforce-pitch product can images (can-berry/soursop/watermelon.png)
---

The product can label copy ("Performance Alkaline Hydration / Net Wt. 325ml (11oz)") is **baked into** the 4000×4000 can PNGs in `artifacts/aforce-pitch/public/` — it is not live text. The three cans share the **same label template position**, so the same pixel coordinates apply to all three.

**Why not AI image edit:** gpt-image-1 `/images/edits` faithfully copies existing pixels (it preserved a "Perfomance" typo instead of correcting it) AND downsamples output to ≤1024px, destroying the native 4000px resolution. Do not use AI re-render to fix baked-in label text.

**How to apply (font-free pixel surgery):** copy a real glyph already present in the label and shift the rest of the line to make room — this preserves the exact font, metallic gradient, curvature, and color with no font install needed. Steps that worked: detect letter gaps via gray-pixel column density, shift the right segment by one glyph-advance, paste the borrowed glyph into the gap. Seams are invisible at the slide's display size (~700px can).

**Gotcha:** the label uses two shades — the first word is a *lighter* gray than the darker "Alkaline Hydration", so a single luminance threshold misses it; raise the threshold (lum<175) to detect the lighter word. Borrow glyphs from the matching shade.
