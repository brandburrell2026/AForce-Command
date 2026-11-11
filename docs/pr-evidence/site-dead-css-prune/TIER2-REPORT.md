# Dead-CSS prune Tier 2 — verification + pixel-neutrality evidence (2026-10-01)

## Verification (multi-agent adversarial workflow, 6 agents)
40 candidate classes (defined in the homepage <style>, statically unreferenced) were
attacked by 4 family agents + an independent second skeptic on the generic names +
a cross-surface agent proving no markup-injection path exists (3 <script> tags total:
JSON-LD non-executing, one inline block, /assets/header.js). Attack surface per class:
dynamic class construction via substrings, innerHTML payloads, querySelector
expectations, compound-selector reachability, and git archaeology (git log -S per class).

Verdict: 37/40 unanimously DEAD — most died in commit aa9795c4 "remove Performance
Profile invite section from homepage" (2026-07-07). 3 spared as UNSURE (quotes, serif,
mono): they NEVER had markup in the file's history, i.e. possibly wired for future use.

## Prune policy corrections beyond the raw verdict
- `bar` and `dash` were verdicted DEAD but were REMOVED FROM THE KILL SET: they appear
  in monogram rules with live ancestors (.afx-nav .nn .bar / .f-nn .bar /
  .clarity-mark .glyphs .dash) and the N–И monogram program is active on another
  branch — Tier-3 protection applies to RULES, not just class names.
- A hard monogram guard (nn / f-nn / afx-nav / clarity-mark / glyphs / n1 / n2 / nflip)
  vetoes any removal whose selector matches, even when all its tokens are dead.
  It kept 6 .hero-mark .glyphs* rules that are dead via hero-mark but monogram-adjacent.

Result: 58 rules/shells removed, 6,794 bytes (~6.6 KB).

## Pixel-neutrality proof (same harness as Tier 1, re-proven today)
Run-vs-run self-check on the pristine tree FIRST: 0 diff pixels on all four surfaces
(home + /aforce-os, 1280 + 375 mobile-emulated; software raster, fonts/images/videos
pinned as documented in REPORT.md). Then before-vs-after:

| Surface | diff pixels |
|---|---|
| home 1280 | 0 |
| home 375 | 0 |
| aforce-os 1280 | 0 |
| aforce-os 375 | 0 |
