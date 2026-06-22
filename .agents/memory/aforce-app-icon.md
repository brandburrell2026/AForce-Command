---
name: AForce app icon (N–N monogram)
description: How the AForce OS app icon / splash / adaptive / favicon are built and why to regenerate from vector, not AI.
---

# AForce app icon — N–N "Non-Negotiable" monogram

The app icon (separate asset from the cinematic splash component / OpeningSequence)
is the **N–N monogram**: two heavy geometric N's facing each other (left forward,
right mirrored with `scaleX(-1)`) in Bone `#F5F0E8`, a short Signal Red `#C1281B`
center bar, on Cinematic Black `#0D0D0D`. No green, no gradients on the letters,
no "AForce OS" text inside the mark.

Files (all in `artifacts/aforce-os/assets/images/`, all already wired in `app.json`
with `#0D0D0D` backgrounds — no app.json edit needed to swap them):
- `icon.png` 1024² — charcoal `#1A1A1A`→black radial vignette behind the mark.
- `adaptive-icon.png` 1024² — solid black, mark scaled smaller to stay inside the
  Android adaptive-icon safe zone (~66% center).
- `splash.png` 1242×2436 — solid black, mark centered (legacy `splash.resizeMode:contain`).
- `favicon.png` 196² — solid black, matches.

**How to regenerate:** font-free vector SVG (the N is three filled shapes: two leg
rects + a top-left→bottom-right diagonal parallelogram) rendered with `rsvg-convert`
(`/nix/store/.../rsvg-convert`, also wired as ImageMagick's svg delegate). The right
N's mirror is its OWN `<g transform="...scale(-1,1)">` so the flip is isolated and
cannot leak onto the bar or any sibling.

**Why vector, not AI:** AI image generation drifts the letterform geometry, the exact
brand colors, and downsamples — the mark must be crisp at icon sizes. Always rebuild
from the vector recipe above.

**Why mirror-isolation matters:** earlier the same `scaleX(-1)` leaked from the
monogram onto caption text in OpeningSequence (see aforce-rn-text-transform). Keep the
flip scoped to exactly the one right-N node.

**Expo Go caches the icon** — after swapping files the old icon shows until the user
fully closes/reopens the project (or clears Expo Go cache). Not a failed change.
