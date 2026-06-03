---
name: Mockup/preview rendering & screenshot gotchas
description: Non-obvious traps when building animated web mockups (SVG gradients, framer-motion ease typing) and verifying them via screenshots.
---

## SVG linearGradient defaults to objectBoundingBox units
A `<linearGradient>` without `gradientUnits="userSpaceOnUse"` interprets `x1/y1/x2/y2`
as objectBoundingBox fractions (0–1), NOT pixels. Passing pixel coords like `x2={220}`
makes the whole stroke fall on the first stop → if that stop is `stopOpacity=0`, the
element renders fully **transparent / invisible** with no error.
**How to apply:** when a gradient-stroked SVG element is mysteriously invisible, add
`gradientUnits="userSpaceOnUse"` (and keep stop offsets in %). Also prefer a per-instance
`useId()` for the gradient `id` so multiple mounts don't collide.

## framer-motion `ease` strings widen to `string` and fail tsc
Inline `transition={{ ease: "easeOut" }}` / variants with `ease: "easeInOut"` typecheck-fail
because the literal widens to `string`, which isn't assignable to framer-motion's `Easing`.
**How to apply:** append `as const` to each ease literal (`ease: "easeOut" as const`).

## external_url screenshot tool caches by normalized URL
The `screenshot` tool with `type=external_url` returns byte-identical frames across calls
even for continuously-animating pages — it strips the hash and ignores query for its cache
key, and `?v=N` cache-busters can break SPA routing (blank page). Trust it only for static
layout, not animation state.
**How to apply:** to verify animated/just-edited mockups live, use `type=app_preview`
(captures fresh through the local `localhost:80` proxy, no external cache).

## app_preview screenshot can drop the LAST DOM-ordered image
When a slide/page has several large images, the `app_preview` screenshot may consistently
omit ONLY the last-painted (last DOM-ordered) image — every other element renders. The
signature: the same image renders fine when it is NOT last, and reordering just moves the
gap to whatever is now last. This is a capture-timing artifact (last image not composited
at snapshot), NOT a CSS/layout bug. `loading="eager"`/`decoding="sync"` did not fix it.
**How to apply:** before chasing a CSS bug, confirm via: (a) all images serve 200, (b) the
element is a valid positioned child with sane coords/z, (c) the missing item changes with
DOM order. If so, trust the live deck and stop debugging CSS.
