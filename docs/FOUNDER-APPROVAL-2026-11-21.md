# Beta direction approved by Brandon (2026-11-21)

Recorded from Brandon's message of 2026-11-21. **Julius's review is open. Legal and Privacy sign-offs, where needed, are open.** Nothing here is merged.

## What Brandon approved

1. **Water goal and HydroState.** Keep logging every ounce. Keep the current scoring cap. Once the goal is met, show "Water goal met" and explain the strongest verified reason if HydroState is still low. Trace the actual 51 from his account and bring the inputs. Review the time-since-last-drink penalty separately with Julius before any formula change is proposed.
2. **Water and sticks card.** Remove the hardcoded "+18 to score" and "+10 to score" claims. Stop repeating the default water-and-sticks card after the water goal is met. Show a next action only when an approved rule supports it. Examples for no intake, partial intake and goal met come to Julius and Brandon before the recommendation change merges.
3. **Alcohol.** Off for beta. Approved future direction: optional, private drink logging with zero hydration credit. Track D9, SS-26, age and regional rules, server enforcement and privacy review before enabling.

## What this PR changes (draft, for Julius)

| Change | File | Scoring touched? |
|---|---|---|
| "+18 to score" removed from the Depleted card, "+10 to score" from the Recovering card | `utils/scoring/copy.ts` | No |
| A member in the Depleted or Recovering band who has met today's water goal gets "Water goal met." instead of the water-and-sticks card | `utils/scoring/copy.ts`, new `utils/scoring/waterGoal.ts` | No. It reads the existing score breakdown |
| One reason line under it, only when a single nameable part is the largest subtraction | same | No |
| No next action on that card | same | No approved rule exists yet |
| The "Skip this and you're likely to land near…" sentence is not added under "Water goal met." | `utils/scoring/copy.ts` | No |

Not changed: the score, the bands, the cap, time-since-last-drink, `scoringEngine.ts`, `statusColor.ts`.

"Goal met" means today's logged ounces are at or above today's target (the same two numbers the screen shows as "124 of 96 oz").

### Wording (Julius to review)

| When | Line |
|---|---|
| Card | Water goal met. |
| The urine check is the largest subtraction | Your last urine check is holding your score down. |
| Reported signals are the largest | The signals you reported are holding your score down. |
| Time since the last drink is the largest | It has been [30 minutes] since your last drink. |
| A wearable-derived part is the largest, two parts tie, or nothing subtracts | (no reason line) |

"The symptoms you reported…" was the first draft. The app's own claims check blocks the word "symptoms" in coaching lines, so the line says "signals".

The other languages carry the English lines for now. They need translating before a non-English release.

### The three examples, from the real rules (in `waterGoalMetCommand.test.ts`)

One member, 96 oz target, water only, last drink 30 minutes ago.

| Example | Logged | Score | Card before | Card now |
|---|---|---|---|---|
| No intake | 0 oz | 0 | Recovery needed: 20 oz water + 2 sticks. · +18 to score | Recovery needed: 20 oz water + 2 sticks. |
| Partial intake | 48 oz | 23 | Recovery needed: 20 oz water + 2 sticks. · +18 to score | Recovery needed: 20 oz water + 2 sticks. |
| Goal met, dark urine and a headache | 96 oz | 39 | Recovery needed: 20 oz water + 2 sticks. · +18 to score | Water goal met. It has been 30 minutes since your last drink. |
| Well over goal, same | 160 oz | 39 | same as above | same as the row above |

The third row shows something for Julius: with a urine reading of 6 and a headache, the app still names time since the last drink, because that part subtracts 22 points against 16 and 12. That is the existing penalty Brandon asked to review separately.

### Open points for Julius

1. The card still carries its "LOG INTAKE" button under "Water goal met." Keep, hide, or relabel?
2. The card's urgency is set to medium. The band colour is unchanged.
3. Other fixed score labels are still in the code and were **not** removed, because the approval names two: "+2" (Peak), "+5" (Balanced), "+12" (morning), and "+15", "+18", "+8", "+12", "+5" on the Social cards. Remove these too?
4. A member in the Balanced or Peak band who met the goal still sees "Sip 12 oz of water now." or the Peak line. Should those change?
5. The six fixed-output test cases that log 96 oz against a 96 oz target changed card. Their scores and bands are identical to before.

## Tracing the real 51

The builder has no access to production data, so the trace is not done. The inputs come from two tables. This read-only query returns them for one account and no secrets; run it on the production database and send the result. Replace the email.

```sql
-- Score inputs for one member. Read-only.
SELECT s.oz_consumed_today, s.oz_target, s.units_consumed_today, s.aforce_units_today,
       s.last_intake_time, s.last_intake_type, s.symptom_state, s.symptoms,
       s.urine_signal, s.energy_state, s.heat_load, s.sweat_rate, s.activity_level,
       s.overnight_loss_oz, s.is_awake, s.body_weight_lbs
FROM aforce_user_state s JOIN aforce_users u ON u.id = s.user_id
WHERE u.email = 'YOUR_EMAIL';

-- Drinks around the recording (Nov 20-21). Read-only.
SELECT l.id, l.fluid_type, l.oz_amount, l.score_before, l.score_after, l.logged_at, l.corrects_intake_id
FROM aforce_intake_logs l JOIN aforce_users u ON u.id = l.user_id
WHERE u.email = 'YOUR_EMAIL' AND l.logged_at >= '2026-11-20' AND l.logged_at < '2026-11-22'
ORDER BY l.logged_at;
```

The state row is the account as it is now, not as it was at 12:17 PM on Nov 21, so the urine and signal values are only useful if they have not changed since. The drink rows carry the score before and after each drink, which is the firm part. Whether wearable data fed the score is in a column this query leaves out on purpose (health data); say if you want it included.

## Time since the last drink

Not changed. For review with Julius: in the examples the penalty is 22 points 30 minutes after a drink in ordinary conditions, 50 points in heat with high activity, and 130 points after three hours, which puts a member who met the goal at 0.

## Alcohol tracker (off for beta)

| Item | Owner | Status |
|---|---|---|
| D9: alcohol outside Social is not logged (`conversation.test.ts:228`) | Julius and Brandon | Stands. Must change before enabling |
| SS-26: alcohol logging with no age check | Brandon | Open. Hidden from store builds (#1217). Server still accepts alcohol |
| Age and regional rules | Counsel (X8) | Not recorded |
| Age check, verified by the server (R-11) | Engineering | Not built |
| Server refuses alcohol without a verified age | Engineering | Not built |
| Privacy review: alcohol entries as sensitive data; export and deletion | Privacy / Counsel | Not recorded |
| Wording for the private alcohol log | Julius | Not written |
| HydroScan label reader | — | Refuses alcohol in every build (PR #1311) |
| One Breath | — | "Alcohol isn't counted toward HydroState, so nothing was logged." |
