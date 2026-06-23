---
name: AForce two band systems
description: Why AForce has two parallel score-band systems (5-band status color + 4-band performance state) and why they must not be collapsed into one.
---

# AForce has TWO intentional, code-backed band systems — do not merge them

There are two *parallel* band ladders in the code with **different thresholds** and
**different jobs**. They look like duplicates/conflicts but are intentional.

1. **Score Status — 5 bands.** `theme/statusColor.ts` (mirrored by
   `utils/hydrationScore.ts`). OPTIMAL ≥85 / STABLE ≥70 / DECLINING ≥50 / RISK ≥30 /
   else CRITICAL. Hexes (calm): `#1FA35A` / `#3DBE7A` / `#FFDE00` / `#FF8C1A` /
   `#FF2800`; each has a Pressure-Mode variant. **Drives:** the AI Coach
   status-color layer (dots, borders, glows, CTA tint) and the score read-out.

2. **Performance State — 4 bands.** Classified by `utils/scoring/breakdown.ts`
   `resolveState` (called from `utils/scoringEngine.ts`): PEAK ≥90 / BALANCED ≥75 /
   RECOVERING ≥60 / else DEPLETED. Has its **own** colors in `theme/colors.ts`
   `states`: PEAK `#1FA35A` / BALANCED `#00E5C8` / RECOVERING `#FFA01E` / DEPLETED
   `#FF2800`. **Drives:** the orb (pulse / flare-on-peak / collapse-on-depletion),
   `riskTimer`, `pulseConfig`, and command selection.

**The only overlap:** both ladders share the top green `#1FA35A` and the bottom red
`#FF2800`. The middle bands genuinely differ (e.g. BALANCED teal `#00E5C8` and
RECOVERING amber `#FFA01E` exist only in the 4-band system; STABLE `#3DBE7A`,
DECLINING `#FFDE00`, RISK `#FF8C1A` only in the 5-band one).

**Why:** during a doc reconciliation the 4-band labels were *mistaken* for display
aliases of the 5-band system and almost rewritten as "no independent hexes" — which
is false. `resolveState` and `theme/colors.ts states` prove the 4-band ladder is a
real, separately-colored system. The architect review caught the error.

**How to apply:**
- Never describe PEAK/BALANCED/RECOVERING/DEPLETED as "aliases" of
  OPTIMAL/STABLE/DECLINING/RISK/CRITICAL — they map by *role*, not by score range,
  and a range-based alias mapping is mathematically wrong (the band edges 90/75/60
  vs 85/70/50/30 do not line up).
- Spec docs previously drifted on the bottom red: design-tokens had DEPLETED
  `#FF2D55` and CRITICAL `#FF0026`; both should be `#FF2800` to match code. The
  separate `whoop.recovery-red` `#FF0026` token is unrelated — leave it.
- When a doc shows a band table, state which system it is and what it drives, and
  cross-reference the other table.
