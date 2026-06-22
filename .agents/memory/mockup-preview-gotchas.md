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

## framer-motion `useScroll({ target })` logs a benign "container has a non-static position" warning
Scroll-linked reveals via `useScroll({ target: ref, offset: [...] })` can keep logging
`Please ensure that the container has a non-static position…` even when the measured ref IS
`position: relative` and the page scrolls on the document. Making the target explicitly
positioned and switching a wrapping `overflow-x-hidden` (which forces `overflow-y:auto` →
implicit non-scrolling scroll container) to `overflow-x-clip` does NOT silence it. It's a
spurious initial-measurement warning; the scroll-driven `useTransform` fill still works.
**How to apply:** don't burn time chasing it. Verify the fill animates on real scroll, gate it
for reduced motion (`useReducedMotion()` → static `100%`), and move on.

## framer reveals need explicit reduced-motion handling — the CSS `prefers-reduced-motion` query does NOT cover them
A `@media (prefers-reduced-motion)` block only disables CSS keyframe animations. framer-motion
`initial/animate/whileInView`, hover lifts, `AnimatePresence`, and scroll-linked spines keep
running, and because reveals start at `opacity:0`, an IntersectionObserver/JS hiccup leaves real
content invisible for reduced-motion users.
**How to apply:** call `useReducedMotion()` and, when true, pass `initial={false}` + drop
`whileInView`/`transition` (render final state instantly); for scroll fills use a static value.

## external_url screenshot tool caches by normalized URL
The `screenshot` tool with `type=external_url` returns byte-identical frames across calls
even for continuously-animating pages — it strips the hash and ignores query for its cache
key, and `?v=N` cache-busters can break SPA routing (blank page). Trust it only for static
layout, not animation state.
**How to apply:** to verify animated/just-edited mockups live, use `type=app_preview`
(captures fresh through the local `localhost:80` proxy, no external cache).

## app_preview screenshot drops the LAST items of a STAGGERED entrance animation
When a row/grid reveals with a per-item framer-motion stagger
(`delay: base + i * step`, `initial={{opacity:0}}`), the `app_preview` screenshot is
captured at a fixed early-ish moment and shows only the items whose delay+duration have
already completed. The trailing items (highest `i`) are still at opacity 0 → they look
"missing" or like blank/paper columns, even though images serve 200 and the DOM is correct.
The tell: the gap is exactly at the stagger boundary (e.g. 8 cols, `delay 0.12 + i*0.1`,
`dur 0.8` → last settles ~1.6s; capture ~1.45s shows cols 0–5, hides 6–7), and it moves
if you change the stagger. NOT a 404, CSS, layout, or decode bug.
**How to apply:** before chasing CSS, confirm (a) all images serve 200 (curl), (b) the file
maps all N items, (c) no console image errors. Then to actually SEE the settled frame,
tighten the reveal so it finishes before capture (e.g. `dur 0.6, delay 0.08 + i*0.05` →
~1s) — also a legit polish for wide lineups. The live deck was always fine.

## A timed full-screen cinematic overlay can't be reliably screenshotted mid-stage
A multi-stage crossfading opening overlay (e.g. aforce-os OpeningSequence) advances on its
own timers and fades between absolute-fill layers, so `app_preview` almost always lands on a
fade/blank moment → returns an all-white/dark frame even though the app is healthy (browser
log shows it running). Don't read white as a bug, and don't keep re-shooting.
**How to apply:** to give the user a verifiable still of ONE stage's final look, build a
static resting-frame replica in mockup-sandbox (faithful 1:1 using the SAME tokens/fonts),
embed it as a canvas iframe, and screenshot that — deterministic, no animation timing.
