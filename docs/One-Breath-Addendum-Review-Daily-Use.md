# One Breath Loop Addendum: Review and Daily-Use Plan

**Reviewed:** "AForce OS · One Breath and the learning loop," proposed engineering addendum, 18 Nov 2026. Checked against the v1.8.2 compilation, the v1.8.3 amendment, the task plan and build rules 15–32, and the research on habit formation and planning.

---

## 1. Verdict

**The engineering is excellent.** These parts are the safest and clearest conversation spec I have seen for a consumer app:
- the conversation contract
- the approval hazards
- the idempotent commit operations
- schema-validated model proposals
- the "plan inclusion is not real-world use" rule
- the honest pilot bar

Keep all of it.

**It won't make the app a daily habit on its own.** The loop is built around *Moments*: a pitch, a workout, a hard conversation. Most people have only a few of those a week. Even then, the payoff ("this line changed because of something you chose to remember") only appears at the **second comparable Moment**, and only when kind and every scope field match. A member could use AFORCE for a week or two before they see that payoff.

People open apps daily when there is a **daily cue** and a **daily payoff that takes under 30 seconds**. AFORCE already has both pieces; they just aren't connected yet:
- the hydration ring, logged through widgets and Siri (the most frequent action)
- the morning and evening prompts "What matters today?" / "What matters tonight?" (Screen Upgrade v1.1)
- calendar spotting (#35, approved Nov 6)
- the lock-screen card (#36)
- Weekly Command

Section 4 connects them into a daily rhythm, without streaks, badges or pressure.

**One adjustment to the goal.** I'd aim for "daily and brief," not "constant." Constitution Principle 11 and D2 rule out engagement-for-its-own-sake, and the habit research supports that choice (Section 3). The aim is a short, useful visit, two or three times a day, without anyone feeling obliged to open the app.

---

## 2. Issues in the Addendum

| # | Issue | Why it matters | Recommendation |
|---|---|---|---|
| 2.1 | It reverses C3 and my amendment §1.4 (no model in beta) | Fixed rules can't handle "pitch thurs. brandon opens," and the reference interaction depends on a model | **I agree with the reversal**, because the adapter is bounded (schema-validated proposals, no tool calls, deterministic numbers). Update amendment §1.4 to match. Before it goes live, decide #41 (on-device vs server) and #42 (no training, zero or minimal retention). Get a data processing agreement. Add the model to the consumer health data policy and consent, since free text will contain health details |
| 2.2 | The payoff waits for a second **comparable** Moment, with strict matching | "Unknown location is not a match" is correct, but strict matching plus rare Moments means few members see a lesson applied in their first weeks | Add **recurring Moments** and **"Same as last time"** (Section 5, #63), so comparable Moments happen weekly by design. Ask for the scope field once when saving the lesson ("Only at this gym, or any morning workout?") instead of failing the match later |
| 2.3 | The pilot measures usability, not daily use | 12 people and 2 Moments can show the path is learnable. It can't show people come back | Keep the 12-person round, then run a **4-week cohort** (#67) measuring useful days (Section 6) |
| 2.4 | No obstacle step | The strongest evidence for planning tools favors **if–then plans that name an obstacle**. Implementation intentions show d = 0.65 across 94 studies ([Gollwitzer & Sheeran 2006](https://www.sciencedirect.com/science/article/abs/pii/S0065260106380021)). Effects are larger when plans are in if–then form and are rehearsed ([Sheeran et al., 642 tests](https://kops.uni-konstanz.de/server/api/core/bitstreams/d703c468-46e9-47fc-8900-d32d7d19c8d9/content)). Mental contrasting with implementation intentions (WOOP) adds goal attainment, g = 0.34 ([meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892/)) | Add one optional Plan question: "What could get in the way?" Turn the answer into one if–then line: "If the train is late, take the 7:10 instead." See #65 |
| 2.5 | "Try it once" is limited to interpersonal Moments | The same research says rehearsed plans work better, so this is the most evidence-backed feature in the addendum | Keep it secondary, but allow it for any Moment with a spoken part (a toast, a team talk, a hard call), and allow a 60-second rerun the morning of the Moment |
| 2.6 | Hydration is disconnected from the loop | AFORCE sells a drink, so the drink should be part of the daily ritual. The addendum correctly says a log never triggers Return, but hydration lines can't become experiments either | Make hydration plan lines eligible behavioral lessons, using the existing template "move water earlier" (Appendix B §6), worded for any drink. Example: "Start hydrating at 4 PM before evening games?" Any counted drink (§2.1) fills it These change timing only, never the target or intake (consistent with D5) — #68 |
| 2.7 | Weekly Command has no time or shape | It's the natural weekly ritual, but undefined | Make it **"Plan your week"**: Sunday evening by default, member-adjustable, opened by the member, a single card. It reviews experiments and suggests up to 3 Moments from calendar and recurrences |
| 2.8 | Draft lifetime is left open | Without it, an interrupted session loses work. Losing work kills daily use faster than anything | Decide now: an owner-scoped, encrypted foreground checkpoint for 24 hours, then discarded. Saved drafts persist until deleted |
| 2.9 | Latency with a model | Mirror ≤ 1.5 s and first reply ≤ 2.5 s on LTE (G1) are hard with a round trip to a model | Run the deterministic parser first for simple edits ("actually 7," "same gym") and use the model only when the parser can't resolve the input. Stream text. Record "model used: yes/no" in telemetry |
| 2.10 | Telemetry can't show whether people use the app daily | The default telemetry (event type, modality, latency) is correct for privacy but defines no retention measure | Add the consented useful-days measure (Section 6). It uses event types only, with no content |

---

## 3. What the Research Says About Daily Use

- **A habit forms when the same cue meets the same action.** In Lally et al., automaticity rose with repetition in a consistent context. The median modeled time to plateau was 66 days (range 18–254), and **missing one day did not materially affect habit formation** ([Lally et al. 2010](https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674/full)). That supports D2 (no streaks): the message should be "come back at the next cue," never "you broke your streak."
- **Anchor AFORCE to cues that already happen every day.** Waking up, the first drink, the commute, the calendar event and bedtime all qualify. That's why the morning card, the widget, calendar spotting and the evening prompt matter more than any notification.
- **Planning is the product, so plan well.** If–then plans with a named obstacle, rehearsed once, are the evidence-backed form (2.4, 2.5). AFORCE's Moment loop is already close to this; adding the obstacle question makes it an if–then plan.
- **Reminders help when they're useful.** Forgetting is the main barrier for hydration ([RCT](https://pubmed.ncbi.nlm.nih.gov/35283036/)). That points to "only when behind" nudges (#57), not regular blasts.

---

## 4. The Daily Rhythm (no streaks, no pressure)

| When | Cue | What the member does (≤ 30 s) | Surface | Rule |
|---|---|---|---|---|
| Morning | Wake, or first unlock after quiet hours | Sees **"What matters today?"**: today's Moments (from calendar spotting and recurrences), one prep line per Moment, the hydration target. One tap: "Plan it," "Same as last time" or "Not today" | Home card (existing single slot) plus Home Screen / Lock Screen widget | Not a notification by default. Optional morning WUT check (#55) folds into this card |
| Through the day | Each drink | Logs in 2 seconds from a widget, Siri, the Control Center control or the watch | Widgets, Siri, watch (P1-4, P1-5) | No praise, no Return. "Only when behind" nudge if opted in (#57) |
| 30 min before a Moment | The Moment | Lock-screen card: the one next action, plus "Practice once" if the Moment has a spoken part | Live Activity / ongoing notification (#36) | Counts as one of the 3 touches |
| After a Moment | Return | One question, 5 seconds, any modality | Return card | Existing rules. Experiment follow-up folds in |
| Evening | First open after the member's chosen time, or deliberate | **"What matters tomorrow?"**: confirm tomorrow's Moments, start hydration timing for early ones | Home card | Shown only on open |
| Sunday | Member's chosen time | **Plan your week**: experiments to keep, edit or retire, plus up to 3 Moments | Weekly Command card | Opened by the member. One optional reminder if opted in |

**Why this works:** each visit is short and tied to an existing cue, and each one gives the member something (a prepared day, a logged drink, a better plan). Nothing in it relies on guilt, streaks or social pressure.

---

## 5. Features That Make the Loop Happen Weekly

1. **Recurring Moments (#63).** "Gym Mon/Wed/Fri 6:30" and "Team standup weekdays 9:00." Each occurrence is its own Moment, with its own seal and Return, linked to a series. Lessons scoped to the series apply automatically, so the second comparable Moment is guaranteed.
2. **"Same as last time."** One tap re-drafts from the last sealed plan of the same kind and place. Every line is shown for review, and "Seal" stays a deliberate action.
3. **Calendar spotting in the beta build (#64).** It's already approved (#35): read-only, one offer per event, never creates or seals. Move it into the beta sequence; it's the main source of daily Moments.
4. **The obstacle question (#65).** It's one optional Plan question and produces one if–then line.
5. **Hydration lines as experiments (#68).** "Start hydrating at 4 PM before evening games?" or "Bring AFORCE to games?" changes timing and items only. Any counted drink counts.
6. **Next-Moment widget.** The medium widget shows the next Moment and its one prep line beside the hydration ring. This is the ambient daily presence.

---

## 6. Measuring Daily Use Honestly (#67)

**North-star measure: useful days per member per week.** A useful day has at least one *member-initiated* action:
- logged a drink
- planned or sealed a Moment
- answered a Return or Replay
- completed the morning check
- or kept, edited or retired an experiment

Rules:
- Consented, event types only, no content (the addendum's telemetry rule).
- Always report denominators and response rates (Loop spec 11.3).
- Never optimize time in app.

| Measure | What it tells you |
|---|---|
| Useful days per week (median, and % of members with 4 or more) | Daily habit |
| D1 / D7 / D30 retention by platform and modality | Whether people come back |
| % of members reaching a second comparable Moment within 14 days | Whether the learning loop happens at all |
| % of offered lessons kept after use | Whether learning is useful |
| "Did that plan work for you?" yes rate, with response rate | Usefulness (existing) |
| Unintended approvals, Quiet failures, private-data disclosures | Must be zero |

**4-week cohort, after the 12-person round:** 40–60 members, text-first and voice-first, iOS and Android, each with at least one recurring Moment.
- **Proposed bar:** a median of 4+ useful days per week in week 4, and at least 60% reaching a second comparable Moment within 14 days.
- **Blockers:** zero unintended approvals and zero Quiet failures.
- These are targets for founders to set, not benchmarks.

---

## 7. New Register Items

| # | Item | Type | Owner | Safe behavior until decided |
|---|---|---|---|---|
| 62 | Daily rhythm: morning "What matters today?", evening "What matters tomorrow?", Plan your week | Founder | Julius, Brandon | Existing prompts only |
| 63 | Recurring Moments and "Same as last time" | Founder | Julius, Brandon | One-off Moments only |
| 64 | Calendar spotting (#35) moved into the beta build | Order change | Brandon | Off until the member turns it on |
| 65 | Obstacle question producing an if–then plan line | Founder + review | Julius | Not asked |
| 66 | Bounded model in One Breath: C3 and §1.4 amended, #41/#42 decided, DPA, consent | Founder + counsel | Julius, Brandon | Deterministic fixtures only |
| 67 | Useful-days measure and 4-week cohort | Founder | Julius | Usefulness question only |
| 68 | Hydration timing lines eligible as experiments | Founder + review | Julius | Hydration lines fixed by playbook |

---

## 8. Claude Code Tasks to Add (after OB-1)

The recommended order is OB-0, OB-1, **OB-7**, OB-3, **OB-8**, **OB-9**, OB-2, OB-4, OB-5, **OB-10**, OB-6. Recurring Moments come early because the pilot needs comparable Moments. Phase 0 still comes first.

### OB-7 Recurring Moments and "Same as last time" (#63)
```
Task OB-7. Read services/momentsStore.ts and types/moments.ts first. Add a
MomentSeries (owner, kind, place ref, recurrence rule RFC 5545 subset:
weekly by day + time, end date optional, timezone). Each occurrence is a
normal Moment linked by seriesId, with its own seal and Return; editing one
occurrence never edits the series unless the member chooses "all future".
Add "Same as last time": draft from the last sealed plan with the same kind
and place, every line shown for review, Seal still deliberate. Lesson scope
may include seriesId. DST and timezone tests required. Registry, export and
deletion in the same PR. Flag: recurring_moments_enabled.
```

### OB-8 Daily rhythm surfaces (#62, #64)
```
Task OB-8. Build the morning "What matters today?" and evening "What matters
tomorrow?" Home cards using the existing single card slot: today's/tomorrow's
Moments (sealed, recurring, and calendar-spotted offers), one prep line each,
hydration target, actions Plan it / Same as last time / Not today. No
notifications by default. Extend the P1-4 medium widget with the next Moment
and its prep line beside the ring. Wire calendar spotting (#35: read-only,
one offer per event, never creates or seals) behind its existing flag. Add
"Plan your week" as the Weekly Command card at a member-chosen time,
member-opened. Tests: touch-budget test proves none of these add an automatic
touch; Quiet/DND tests; render tests. Flag: daily_rhythm_enabled.
```

### OB-9 Obstacle question and if–then line (#65); hydration experiments (#68)
```
Task OB-9. Add one optional Plan question "What could get in the way?" after
the plan lines. A validated answer becomes one if–then line ("If <obstacle>,
then <action>") using the existing action-template set; free text is never
executable. Member can skip; skipping changes nothing. Separately, allow
the "move water earlier" template (copy: "Start hydrating earlier",
any counted drink per hydrostate-v3.0) to be a Replay experiment line for
eligible Moments; it may change timing only, never target, intake or score
(D5). Flags: obstacle_plan_enabled, hydration_experiments_enabled.
```

### OB-10 Useful-days measure (#67)
```
Task OB-10. Add consented, content-free events for member-initiated actions
(drink_logged, moment_planned, moment_sealed, return_answered,
morning_check_done, experiment_decision). Build an internal read model for
useful days per member-week, D1/D7/D30 retention, second-comparable-Moment
rate within 14 days and lesson keep rate, always with denominators and
"Not enough evidence yet" below the minimum sample (#7). No content, names or
location. Excluded entirely without analytics consent. Flag:
usefulness_metrics_enabled.
```

---

## 9. Bottom Line

The addendum makes One Breath trustworthy. To make AFORCE a daily habit, add a rhythm around it:
- a 10-second morning card
- 2-second drink logging
- an evening "tomorrow" check
- a weekly plan
- recurring Moments, so the learning loop pays off within days instead of weeks

Measure useful days, not time in app.
