# Hydration · "262 of 96 oz" with a 100% ring — audit

**Date:** 2026-11-18 · **Code:** `main@85d8a708` · **Seen on:** iPhone build 165 (Brandon's screen recording)
**Scope:** read-only code audit. **No data was read or changed** (I have no access to the production database), and no hydration maths was touched.

## 1. What the screen is doing

| Element | Source | Behaviour |
|---|---|---|
| "262 of 96 oz" | `ozConsumedToday` and `ozTarget` from the server | Shown as stored, with no upper limit |
| Ring "100%" | `min(1, consumed / target)` in `components/hydration/HydrationScreenV2.tsx` | **Capped at 100% on purpose** |

So the two numbers agree with each other: 262 ÷ 96 is 273%, and the ring stops at 100%. The display is working as written. The open question is whether **262 is a true total**.

## 2. Why 262 can be reached

**F1 · The "day" is a UTC day, not the member's day.** `artifacts/api-server/src/lib/aforceState.ts` resets today's ounces when the first request arrives after midnight **UTC** ("UTC is intentional for V1 … switch to user-local once the profile carries a timezone"). For a member in the US that is 7:00 PM Eastern / 4:00 PM Pacific in November. Everything logged from yesterday evening onward counts as "today" until this evening. A member who logs in the evening and again the next day sees both added together.

**F2 · Water logs from store builds carry no duplicate-protection key.** Internal builds (164, 165) turn on the offline outbox, which sends a key with every water log, and the server ignores a repeat of the same key. Store builds leave it off (`offline_intake_outbox_enabled: false`), and `sendPreparedIntake` then sends **no key**; the database index cannot match rows without one. A lost reply followed by "try again" saves the water twice. Yesterday's fix (RA-N5) covered the non-water `/drinks` route only.

**F3 · A second tap is a second drink.** In every build each tap mints a new key, by design. Two quick taps, or a tap after an error message, are two entries. There is no "same amount within N seconds" guard.

**F4 · Limits.** One entry may be up to 200 oz (server) or 64 oz (scan screen). There is **no daily limit**, so 262 needs only two or three entries.

**F5 · The list and the total use different windows.** "Recent intake" shows a rolling 24 hours of events; the total is the UTC day. They can disagree.

**F6 · Testing.** Builds 161–165 were all exercised today on the same account. Repeated test logs, on top of F1, are the most likely explanation, but I cannot confirm it without the entries.

## 3. High-intake safety behaviour

**None is approved or built.** Stop-ship row RA-N9 already records that no overdrinking rule exists; values and wording need the scientific approver. Today the app shows 262 of 96 with no acknowledgement, no "over your starting point" state and no caution. I have not added one: it would be new health guidance.

## 4. What I need to confirm the cause (read-only)

Run on the production database, replacing the member id. It only reads.

```sql
SELECT id, fluid_type, oz_amount, entry_source, client_event_id IS NOT NULL AS keyed,
       corrects_intake_id, logged_at AT TIME ZONE 'UTC' AS logged_utc
FROM aforce_intake_logs
WHERE user_id = '<member id>' AND logged_at > now() - interval '48 hours'
ORDER BY logged_at;
```

What to look for: pairs with the same amount seconds apart and `keyed = false` (F2/F3); entries from before local midnight still inside the current UTC day (F1).

## 5. Proposed corrections (none started; each needs approval)

| # | Correction | Type | Approval needed |
|---|---|---|---|
| P1 | Send the duplicate-protection key on every water log, in store builds too | Data integrity; no maths change | Brandon |
| P2 | Reset the day at the member's local midnight | **Changes what "today" means, so it changes HydroState inputs** | Julius + Brandon; a model-version note |
| P3 | Show over-target intake honestly (for example "262 oz · above your starting point") without a percentage above 100 | Display; wording is health-adjacent | Julius (wording) |
| P4 | Overdrinking rule and caution | New safety behaviour | Scientific approver (RA-N9) |
| P5 | Edit / delete a wrong entry | Stored data | Founder decision D17 |

**Recommendation:** P1 first. It is small, changes no calculation, and closes a real double-count in the builds members will get.
