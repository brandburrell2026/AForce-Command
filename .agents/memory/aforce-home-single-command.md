---
name: AForce simplified Home single-command contract
description: The simplified Home must render exactly one primary CTA owned by the pure homeCommand resolver; competing in-card buttons must be expanded-only.
---

# Simplified Home = exactly ONE command + ONE CTA

The simplified Home (when `SHOW_EXPANDED_HOME = false` in `app/(tabs)/index.tsx`)
reads top-to-bottom: readiness hero → Hydration Status card → ONE command block
→ ONE primary CTA. The single command is derived by the pure, RN-free
`utils/homeCommand.ts` resolver (priority: water → recovery → protocol → scan),
and its CTA owns every action — including "scan a drink" via the `scan_drink`
command.

**Rule:** any *other* actionable button on Home (e.g. the `HydrationStatusCard`
in-card "SCAN A DRINK" button, exposed via its `onScan` prop) must be gated to
expanded mode — pass it `onScan` only when `SHOW_EXPANDED_HOME` is true. If it
renders in simplified mode it becomes a SECOND CTA and can let a non-water action
sit beside/above the water command.

**Why:** the spec's simplified-Home contract is one instruction + one action, and
Water-First means no action may compete with or precede the water command. A
stray always-on card button silently breaks both. (Caught in architect review.)

**How to apply:** when adding anything tappable to a Home card/component, thread
the visibility through `SHOW_EXPANDED_HOME` (default off) instead of rendering it
unconditionally. Keep the action reachable through the homeCommand block, not a
parallel button.

## Owner-approved exception: ONE secondary "Scan Drink" utility chip

The owner explicitly asked to keep HydroScan reachable from simplified Home. The
sanctioned way is a single, deliberately *secondary* "Scan Drink" chip
(`testID home-secondary-scan`) rendered directly under the Hydration Status card
in `ScoreDrivenBody`. This does NOT break the one-CTA rule because it is gated and
visually subordinate — do not delete it as a "second CTA".

**Rules that keep it compliant (preserve all of them):**
- Gate: `!SHOW_EXPANDED_HOME && command.actionType !== 'scan_drink'`. It is hidden
  when Scan is already the primary command (the CTA becomes SCAN DRINK — no
  duplicate) and on expanded Home (where `HydrationStatusCard` renders its own
  in-card scan via `onScan`, so my chip would be a second scan).
- It must stay muted (neutral hairline chip, `text.secondary`, small type — NOT a
  brand-accent/glowing CTA) so it can never read as the daily command.
- On press it reuses the existing `onCommandCta('scan_drink')` handler → existing
  `/scan` route. It must never log intake or mutate score (Score-Protection); it
  only navigates. Do not create a duplicate scan flow.
- It renders AFTER the Hydration Status card, so the hydration need is evaluated
  before any drink check-in (Water-First holds).

**Why:** "exactly one CTA" still holds (one primary command CTA + one quiet utility
chip is the owner's intent), and the muted treatment + gating prevent it from
competing with or preceding the water command.

## homeCommand Water-First: no-fluid-logged ⇒ water leads

`homeCommand` treats `unitsConsumedToday <= 0` (or a null last-intake timestamp)
as "behind pace", so the water command leads even at an optimal score with a
recent timestamp. Both signals are honored so the caller can supply either and
water is never skipped when nothing has been logged today. Don't let
`unitsConsumedToday` become a dead input — it gates the water branch.
