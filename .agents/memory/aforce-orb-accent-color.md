---
name: AForce Home orb accent color source
description: Which color system the Home Readiness orb actually renders, and how to match it on other Home surfaces.
---

# Home orb accent color — match the orb, not "the score color"

There are TWO parallel score→color systems in aforce-os and they diverge at
the same score:

- `utils/scoreBand.ts` (`accentForScore` / `Colors.states`) — **4 bands**:
  PEAK / BALANCED / RECOVERING / DEPLETED.
- `theme/statusColor.ts` (`getStatusColor`) + `services/hydrationStatus.ts` —
  **5 bands**: OPTIMAL / STABLE / DECLINING / RISK / CRITICAL.

The Home Readiness **orb renders the 4-band color**, specifically the tweened
value from `useDisplayedAccent()?.primary` (it falls back to `getHydrationStatus`'s
5-band color only when the displayed accent is null). So at score 92 the orb is
lime `#B6FF00` (PEAK), while `getStatusColor(92)` is green `#16EC06` (OPTIMAL) —
a visible mismatch.

**Rule:** any Home surface that must "match the orb's color" must read
`useDisplayedAccent()?.primary` (it's available because the Home tree is wrapped
in `DisplayedAccentProvider`, which mounts around `ScoreDrivenBody`/`HomeDashboard`),
with a fallback to `accentForScore(engine.score).primary`. Do NOT reach for
`getStatusColor` — it produces a different hue at the same score and won't track
the orb's count-up tween.

**Why:** the request "make X reflect the hydration score color" means *match the
orb the user is looking at*, and `useDisplayedAccent` recolors on the same
animation frame the orb digit changes, so dependent surfaces stay in lock-step.

**How to apply:** when tinting a new Home card/ring/button from the score, import
`useDisplayedAccent` from `hooks/useDisplayedAccent` and `accentForScore` from
`utils/scoreBand`; never mix the 4-band and 5-band palettes on the same screen.
