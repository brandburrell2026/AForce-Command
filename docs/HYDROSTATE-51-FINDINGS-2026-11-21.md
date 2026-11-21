# HydroState held at 51: findings for Julius and Brandon

2026-11-21. Read-only trace. **No scoring, band, recommendation or daily-reset code was changed.**

## What was seen

Founder's iPhone, build 205, two recordings:

| When (phone clock) | Home / Hydration showed |
|---|---|
| Nov 21, 1:35 AM | 92 of 96 oz. Recent list: Water 62 oz and Water 32 oz, both labelled "Yesterday". |
| Nov 21, 12:17 PM | 124 of 96 oz, updated 11:43 AM. HydroState 31. |
| after logging 34 oz | HydroState 51 ("+20"). |
| after logging 16 oz more | HydroState 51. |

## What could not be done

The brief asks for the account's own entries and timestamps. The build author has
no access to production data, so nothing below is read from the account. It is
from the code, checked against the numbers on screen. To confirm it, one of
these is needed: the account's export from Profile › Account › download data,
or the answer to one question: **were the 62 oz and 32 oz logged on the
evening of Nov 20 (after 7 PM Eastern)?**

## Finding 1: "today" resets at midnight UTC, not at the member's midnight

`artifacts/api-server/src/lib/aforceState.ts`, `applyDayRollover`. Today's
total (`ozConsumedToday`) is reset when the UTC date changes. The comment says
this is deliberate for V1 because the server holds no time zone for a member.
It still holds none.

For a member on Eastern time the day therefore turns over at **7 PM**:

- A drink logged between 7 PM and midnight counts toward **tomorrow's** total.
- From midnight until 7 PM the next day, "today" includes the previous evening's drinks.

That matches the screens exactly if the 62 oz and 32 oz were logged on the
evening of Nov 20: 92 oz was still "today" at 1:35 AM, and 32 oz logged at
11:43 AM made it 124. No other path to those numbers was found: every writer
of the member's state runs the reset first, and the app shows the server's
figure without adding to it.

- **Is a cap applied to the total?** No. The total is a plain sum.
- **Target:** 96 oz on screen ("starting target").

**Proposed fix (not built):** the app sends its time zone with each request;
the server resets on the member's local date and falls back to UTC when none
is sent. A regression test at local midnight (23:59 → 00:01, and 7 PM Eastern
no longer resetting). This is a server change and needs a deploy.

## Finding 2: why the score stops at 51

`artifacts/aforce-os/utils/scoring/breakdown.ts` (protected).

- The score's water term measures intake against the target and **stops at the
  target**: at most 89 points, however much more is drunk.
- It is worked out from the drinks of the last 24 hours, not from the day's
  total, so it does not have Finding 1's problem.
- Everything else in the score only subtracts: time since the last drink
  (faster with heat and activity), reported symptoms, and the urine signal;
  plus a recovery term limited to ±10.

So 31 → 51 is the 34 oz bringing the 24-hour intake up to the target, and
51 → 51 is the next 16 oz adding nothing because the water term was already
full. The remaining 38 points are being held down by the subtracting terms.
Which of them, and by how much, needs the account's data.

## Finding 3: what triggers "20 oz water + 2 sticks"

`artifacts/aforce-os/utils/scoring/copy.ts`, `generateCommand` (protected).

The command is chosen by **band alone**. Any score from 0 to 59 is "Depleted"
and always gets the same line, "Recovery needed: 20 oz water + 2 sticks", with
"+18 to score" attached. It does not look at how much has been drunk today.

Two consequences for a member who is already over target:

- Water and product count on the same curve, so neither the 20 oz nor the
  sticks can raise the water term once it is full.
- "+18 to score" is a fixed label, not a calculation for this member.

## Decisions needed

1. Reset "today" at the member's local midnight (Finding 1)? Not a scoring rule, but it changes what "today" means and needs a server deploy.
2. Is the cap on water at target the intended behaviour when the score is still low (Finding 2)?
3. Should the Depleted command and its "+18" take today's intake into account (Finding 3)?
