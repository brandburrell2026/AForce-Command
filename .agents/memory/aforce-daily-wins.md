---
name: AForce Daily Wins engine
description: How positive-reinforcement "wins" are derived and surfaced on home.
---

Priority #3 added a positive-reinforcement layer. Design mirrors the
explainability layer: a PURE helper + a thin slice-reading banner.

- `utils/dailyWins.ts` (`buildDailyWins` / `topDailyWin`) is pure and
  `Date`-free: it takes a flat snapshot of REAL state and returns wins
  sorted by priority. The home surface shows only the single top win
  (one line). Empty array = "nothing earned yet" → render NOTHING; the
  banner must never emit a negative/guilt/penalty line.
- Win signals come from real fields only (no fabrication):
  complianceStreak tiers (>=7 / >=3 / >=1, mutually exclusive),
  unitsConsumedToday vs dailyTarget (daily_goal) and >=1 (water_cycle,
  the frequent small win), recoveryTrend==='rising' split by recovery
  >=80 (stabilized_faster) vs <80 (recovery_trend), and a fresh positive
  ±3 confirmation (first_correction).
- `components/home/DailyWinBanner.tsx` derives the recovery snapshot via
  the existing recoveryEngine and computes correction freshness
  (<=30min, matching the engine's stale-confirmation cutoff) at the call
  site so the helper stays pure. Rendered right after NotificationBanner
  on the existing home screen — no new nav, no feature flag (self-hides).

**Copy lock:** every win line stays ONE short line, positive, no guilt/
shame/penalty words. Retention over gamification — reinforce behaviour,
never rank or invite competition.

**Honesty caveat:** the `first_correction` id matches the spec's wording
but copy deliberately does NOT claim literal first-ever, because there is
no persisted "has ever corrected" flag — it fires whenever a fresh
positive correction is present. Don't "fix" this by inventing a flag
without product sign-off.

**Why:** the spec lists 8 win types but several ("stabilized faster",
"recovery trend") share one underlying signal (recoveryTrend). They were
split by recovery magnitude rather than fabricating a second signal.
