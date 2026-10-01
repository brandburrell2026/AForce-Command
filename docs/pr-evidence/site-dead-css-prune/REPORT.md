# Dead-CSS prune — pixel-neutrality evidence (2026-10-01)

## What was removed
- `aforce-site/index.html`: 104 rules (~11.9 KB) — the `os-*` DOM-phone-interior family
  orphaned when PR #963 replaced the hand-built phone mockups with Black Issue renders.
  Live classes (`os-phone`, `os-phones`, `--front/--back/--shot`, `os-visual`) untouched.
  One compound (`.os-visual.visible .os-arc-fill`) removed deliberately: it requires the
  never-occurring `os-arc-fill`, so it can never match.
- `aforce-site/aforce-os/index.html`: 5 rules (~0.4 KB) — `.flip-n`, `.hd-m`, `.note`
  (+ 2 `.note` compounds), orphaned by the #964 Before-the-Moment rebuild.

Dead-set definition: class defined in the page's `<style>` but absent from every
`class=""` attribute, every `classList.add/toggle/remove` literal in inline scripts,
and `assets/header.js` (the only shared DOM-injecting script). A rule was removed only
if EVERY comma-separated selector part references at least one dead class.
Explicitly excluded (Tier 2/3 of the scope): ~67 older orphan rules, all monogram
(`.f-nn`/`.n1`/`.n2`/`.nflip`) rules — active program in flight — and dynamic state
classes (`is-active`, `is-on`, `current`).

## Proof of zero rendering change
Full-page screenshots, before vs after, four surfaces:
home @1280, home @375 (mobile-emulated), /aforce-os @1280, /aforce-os @375.

Harness determinism was PROVEN before trusting any comparison: two independent runs of
the unmodified tree had to produce byte-identical captures first. Three nondeterminism
sources were found and neutralized along the way (each verified by re-running the
self-check): the fixed `.grain` overlay under fullPage stitching; lazy-image decode
racing capture (fixed by awaiting `img.decode()` for every image); late font loads
re-rendering text after the first `fonts.ready` (fixed by re-awaiting after the scroll
pass); and residual GPU image-resampling jitter on 1280-wide full-page surfaces (fixed
with `--disable-gpu --force-color-profile=srgb --disable-lcd-text`). Final self-check:
run-vs-run = 0 diff pixels on all four surfaces.

Result (before vs after, same harness):
| Surface | diff pixels |
|---|---|
| home 1280 | 0 |
| home 375 | 0 |
| aforce-os 1280 | 0 |
| aforce-os 375 | 0 |

Videos hidden and animations frozen identically in both arms (reduced-motion emulated);
captures are byte-identical pairs, so the PNGs themselves are not committed — this
report and the reproducible harness description are the evidence.
