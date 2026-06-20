---
name: AForce Weekly Report — Score-Protection anchoring
description: Cross-week/global signals must be re-anchored to the report window before they can be shown as a "this week" win, or an empty week fabricates a win.
---

# Weekly Performance Report — anchoring rule

The Weekly Report is a read-only weekly projection. Each section is honest:
`improved | attention | steady | collecting | awaiting`. Only Habit Velocity is a
genuinely real, weekly-windowable signal today; Performance Age movement / Recovery
trend / Readiness need persisted **daily snapshots** (none yet → `collecting`) and
Top command needs command metadata on events (none yet → `awaiting`).

## The rule
Any signal sourced from the **full analytics log** (e.g. `currentDayStreak`,
lifetime counters) spans week boundaries. Before it can appear as a *report-week*
"What improved" finding it MUST be gated on the report week actually having
activity (`!noWeekData`). The classic trap: an empty report week + a streak built
in the *following* partial week (internal preview opened mid-week) renders
"N-day streak going strong" — a fabricated win that violates Score-Protection.

**Why:** Score-Protection means the report never invents a positive; an inactive
week must read `collecting`, not celebrate. The streak number is real, but it is
not *this completed week's* win.

**How to apply:** When adding any finding to the "improved"/"attention" roll-ups,
ask "is this metric windowed to the report week?" If it comes from
`computeAnalyticsMetrics(fullLog)` (not a per-window count), guard it with
`!noWeekData` (or compute a windowed version). `active_days_*` is already safe
(it's 0 when the week is empty); `streak` is the one that needs the guard. Add a
regression test: empty report week + later-week streak ⇒ `improved.status ===
'collecting'` and no streak finding.

## Nav / exposure
No new tab (Nav lock). Entry = non-tab route `app/weekly-report.tsx` (registered in
`app/_layout.tsx` Stack) + a Modules launcher card (always listed, internal eval) +
a Profile row gated on `featureFlags.spec_weekly_report` (Build 100% · Show 10%).

## i18n scope decision
The i18n lock governs the **report's user-facing content** (the 7 sections +
Water-First "next week focus" lead), fully localized via `reports.*` in all 11
locales. The entry-point chrome (Modules card, Profile SectionHeader/label) is left
hardcoded English on purpose: `modules.tsx` is 100% hardcoded English and
`profile.tsx`'s sibling launchers (INVITE / GOALS / MODULES / PROTOCOL TOOLS /
HARDWARE) are too — localizing one launcher row while five siblings stay English
would be incoherent. Revisit only if those entry surfaces get a localization pass.
