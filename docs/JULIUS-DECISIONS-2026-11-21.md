# Three decisions for Julius and Brandon (2026-11-21)

Brandon's proposed direction is stated first in each section. Nothing here has been built or changed. No scoring, band or recommendation rule was touched; the figures come from running the app's existing rules on made-up days, not from any member's data.

## 1. Alcohol logging

**Proposed scope (Brandon):** optional, private logging, with zero hydration credit. Verify D9 and SS-26 and record the approvals before enabling it.

### What was verified

| Rule | Where | What it says today | Status |
|---|---|---|---|
| D9 | `artifacts/aforce-os/utils/__tests__/oneBreath/conversation.test.ts:228` | "Had two beers" outside Social: the reply is "not counted" and no drink is logged | Passing. Enabling alcohol logging in One Breath means changing this test, which is a spec test |
| SS-26 | `governance/BETA-RELEASE-CHECKLIST.md:137`, `docs/AFORCE-OS-v1.9-Audit-A-H-2026-11-18.md:143` | Alcohol logging with no age check. Hidden from store builds by #1217 (2026-11-18). "No age check; server still accepts alcohol" | **Open (partly fixed)** |
| R-11 / B18 | Audit A–H line 201 | Age check and alcohol gate: sign-in metadata, verified by the server, alcohol hidden by default | Not built. No age-check code was found in the app or the server |
| X8 | Audit A–H line 380 | Age check, alcohol gate and regional rules need Counsel | Not recorded |
| SS-05 | Checklist line 137 | BAC and "do not drive" logic still in the build | Open |

Today alcohol is offered only in development and internal TestFlight builds. One Breath answers "Alcohol isn't counted toward HydroState, so nothing was logged." The HydroScan label reader refuses alcohol in every build (changed today).

### Approvals to record before it is enabled

| Approval | Who | Recorded |
|---|---|---|
| Change D9: alcohol may be logged privately outside Social, zero credit | Julius and Brandon | No |
| Age and regional rules (minimum age, where it is offered) | Counsel (X8) | No |
| Age check built and verified by the server (R-11) | Engineering, then Brandon | No |
| Server refuses an alcohol entry without a verified age | Engineering | No |
| Privacy: alcohol entries are sensitive data (Night Out spec §11–12); retention, export and deletion cover them | Privacy / Counsel | No |
| Wording for the alcohol log and its "not counted" line | Julius | No |

### Questions for Julius

1. Is "optional private logging, zero hydration credit" the scope you approve?
2. Does a logged alcoholic drink appear anywhere besides the private drink log (Home, Journal, Replay)?
3. Does alcohol stay out of any score, recommendation or Social safety logic until a separate ruling?

## 2. Water at target

**Proposed (Brandon):** keep logging every ounce the member reports. When today's water goal is met and HydroState is still low, show "Water goal met" and explain what is holding the score down if the app can identify it. Evidence first, before any change to how the cap affects the score.

### Already true

Every ounce is logged. Today's total is a plain sum with no cap (the screen showed 124 of 96 oz).

### Evidence: the app's existing rules on made-up days

One member, 96 oz target, water only, drinks spread over ten hours, last drink 30 minutes ago unless stated. Score parts are the app's own breakdown.

| Day | Water logged | Score | Water part | Time since last drink | Symptoms | Urine |
|---|---|---|---|---|---|---|
| A. Nothing else reported | 0 oz | 0 | 0 | −391 | 0 | 0 |
| | 48 oz | 23 | 45 | −22 | 0 | 0 |
| | 96 oz (goal) | 67 | 89 | −22 | 0 | 0 |
| | 124 oz | 67 | 89 | −22 | 0 | 0 |
| | 160 oz | 67 | 89 | −22 | 0 | 0 |
| B. Dark urine (6 of 8) and a headache | 48 oz | 0 | 45 | −22 | −16 | −12 |
| | 96 oz (goal) | 39 | 89 | −22 | −16 | −12 |
| | 160 oz | 39 | 89 | −22 | −16 | −12 |
| C. Heat 9, activity 9 | 96 oz (goal) | 39 | 89 | −50 | 0 | 0 |
| | 160 oz | 39 | 89 | −50 | 0 | 0 |
| D. Last drink 3 hours ago | 96 oz (goal) | 0 | 89 | −130 | 0 | 0 |
| | 160 oz | 0 | 89 | −130 | 0 | 0 |

What this shows:

- The water part stops at 89 once the goal is met. 124 oz and 160 oz score the same as 96 oz.
- After the goal, the score is set by what subtracts: time since the last drink, symptoms and the urine signal.
- **Time since the last drink is large.** In ordinary conditions it takes 22 points 30 minutes after a drink and 130 points after three hours, which puts a member who met the goal at 0. In heat with high activity it takes 50 points after 30 minutes. This is the app's existing rule; it may deserve its own review.
- The app already knows each part, so it can say which one is holding the score down without any change to scoring.

Limits: these are constructed days, not the founder's account. The 51 in the recording is consistent with a full water part (89) and 38 points of subtraction, but which parts made up the 38 needs that account's data.

### What could be shown (display only, wording is a draft for Julius)

| Situation | Draft line |
|---|---|
| Goal met, score fine | Water goal met. |
| Goal met, urine signal is the largest subtraction | Water goal met. Your last urine check is holding your score down. |
| Goal met, symptoms are the largest | Water goal met. The symptoms you reported are holding your score down. |
| Goal met, time since last drink is the largest | Water goal met. It has been [3 hours] since your last drink. |
| Goal met, the app cannot tell | Water goal met. |

### Questions for Julius

1. May the app show "Water goal met" and one reason line as a display-only change, with scoring untouched?
2. Is the wording above right? "Holding your score down" must stay an observation, not a diagnosis.
3. Should the cap itself change (credit past the goal), or stay? This brief does not propose a change.
4. Should the time-since-last-drink rule be reviewed separately, given the table?

## 3. "20 oz water + 2 sticks"

**Proposed (Brandon):** the card accounts for what the member already logged today. When they have already done the recommended action, acknowledge it and show the next relevant step. Examples first, before any change to the recommendation rules.

### What the card does today

It is chosen by band alone (`utils/scoring/copy.ts`, protected). It does not read today's intake. The "+18 to score" label is fixed text, not a calculation.

| Example | Water logged today | Score | Card shown today |
|---|---|---|---|
| No intake | 0 of 96 oz | 0 | Recovery needed: 20 oz water + 2 sticks. · +18 to score |
| Partial intake | 48 of 96 oz | 23 | Recovery needed: 20 oz water + 2 sticks. · +18 to score |
| Goal met, score still low (dark urine and a headache) | 96 of 96 oz | 39 | Recovery needed: 20 oz water + 2 sticks. · +18 to score |
| Well over goal, same signals | 160 of 96 oz | 39 | Recovery needed: 20 oz water + 2 sticks. · +18 to score |
| Goal met, nothing else reported | 96 of 96 oz | 67 | Open a water cycle: 16 oz water + 1 stick. · +10 to score |

In the third and fourth rows the water part is already full, so more water cannot raise it; a new drink can only reset the time-since-last-drink part (22 points in that example, not 18).

### What it could say (drafts for review; the "next step" is a recommendation rule and is Julius's call)

| Example | Draft card |
|---|---|
| No intake | Recovery needed: 20 oz water + 2 sticks. (unchanged) |
| Partial intake | You've logged 48 of 96 oz. Next: 20 oz water + 2 sticks. |
| The member logs 20 oz water and 2 sticks after seeing the card | Done: 20 oz water + 2 sticks logged. Next: [next step] |
| Goal met, score still low | Water goal met. [What is holding the score down.] Next: [next step] |

### Questions for Julius

1. What is the "next relevant step" once water is met and the score is still low: sticks only, a urine check, rest, or nothing?
2. Should "+18 to score" be removed, or replaced by a figure the app actually calculates for that member?
3. "Already completed" needs a definition: logged since the card first appeared, or at any time today?
4. Sticks count on the same curve as water today. Should a stick be acknowledged separately from water?

## What happens after the rulings

Each ruling becomes its own draft PR with tests. Changes to the score cap or the recommendation rules touch protected files and need the explicit approval of both founders.
