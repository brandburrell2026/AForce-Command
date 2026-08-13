# Device QA Script — the Wave-5 TestFlight build

**Status:** OPERATIVE · **Created:** 2026-08-12
**Target:** the TestFlight build containing all Wave-5 work. **Build 59 does not qualify** — it
predates every Wave-5 change. Confirm the build number before starting.

Run on real hardware. Simulator passes do not close a row here: touch targets, Dynamic Type,
VoiceOver behaviour and reduced motion all differ on device.

**Recording rule:** a row is closed by a screenshot or an explicit written observation. "Looked
fine" is not a result. Note the device and iOS version once at the top of each pass.

---

## A · The screens

| # | Surface | What to check | Result |
|---|---|---|---|
| 1 | **Home** | one dominant number; band-aware colour (green at PEAK — **not red**); WHY visible without a tap; secondary information quiet | ☐ |
| 2 | **Building Your Baseline** | on a **fresh account**: no fabricated score, no band word, no digit; reads as intentional, not an error; the one action is obvious | ☐ |
| 3 | **HydroState** | reads as a current operating state, not points/game score/credit score; arc draws itself once | ☐ |
| 4 | **Hydration logging** | count the taps to log a standard intake; confirmation felt; state transition visible | ☐ |
| 5 | **Primary Command** | unmistakable; WHAT / WHEN / WHY / confidence legible at a glance | ☐ |
| 6 | **Moments** | what's coming → when prep matters → what to do; stays subordinate to the Command | ☐ |
| 7 | **Performance Signal** | one dominant number; detail behind disclosure; confidence chip legible | ☐ |
| 8 | **Protocol** | TODAY → NEXT → WHY → PROGRESS; sparse state reads deliberate | ☐ |
| 9 | **Week in Review** | back control present and reachable; a small Performance Age change **looks small** | ☐ |
| 10 | **Scan** | camera path works; **the PREVIEW SCAN tray must be absent** in a store build | ☐ |
| 11 | **Circle** | every sample row shows SAMPLE; **no Verified badge on a sample person**; your own row is distinguishable | ☐ |
| 12 | **Onboarding** | location is **not** requested before its explanation; count steps and taps to first trusted action | ☐ |
| 13 | **Profile** | named sections; **Terms / Privacy / Health Disclaimer / Contact Support all reachable**; no developer controls visible | ☐ |
| 14 | **Subscription / purchase / activation** | plan selection legible; purchase completes; entitlement reflects (ties to runbook steps 5–7) | ☐ |

## B · States

| # | State | What to check | Result |
|---|---|---|---|
| 15 | **Loading** | no blank/black screens; skeletons hold layout shape; **nothing shows stale data as fresh** | ☐ |
| 16 | **Empty** | teaches what happens next; never reads as broken | ☐ |
| 17 | **Degraded / error** | answers WHAT HAPPENED / WHAT STILL WORKS / WHAT CAN I DO; no technical copy. Force it: **airplane mode** mid-session, then pull-to-refresh on Performance Signal and Week in Review | ☐ |

## C · Accessibility (beta gate)

| # | Check | How | Result |
|---|---|---|---|
| 18 | **VoiceOver — Home** | swipe through: hero announces **once**, not twice; confidence chip is heard | ☐ |
| 19 | **VoiceOver — Performance Signal** | each day card is **one** announcement carrying day, band, score — not loose fragments | ☐ |
| 20 | **VoiceOver — Circle** | each row is one announcement, and includes *"Sample data, not a real member or a real standing"* | ☐ |
| 21 | **VoiceOver — Week in Review** | the timeline announces actual values, not just weekday names | ☐ |
| 22 | **Touch targets** | Circle tabs, Subscription filters, Moment feedback pills all comfortably tappable | ☐ |
| 23 | **Dynamic Type** | Settings → Accessibility → Larger Text at **XL and max**: text reflows, does not clip or shrink-to-fit | ☐ |
| 24 | **Contrast** | canceled/past-due subscription status readable (was ~3.1:1) | ☐ |
| 25 | **Reduced motion** | Settings → Accessibility → Reduce Motion **on**: no pulsing, no shimmer, arc does not animate | ☐ |
| 26 | **Announcements** | async content and errors are spoken, not silent | ☐ |

## D · Identity

| # | Check | Result |
|---|---|---|
| 27 | Sign out → sign in: state restores from server, no fabricated values in between | ☐ |
| 28 | Account switching: **no data bleed** between accounts (Wave-2 isolation) | ☐ |
| 29 | Cold launch signed in: no auth race, no flash of a wrong or fabricated state | ☐ |

---

## E · The one judgment call

**Home confidence treatment — evaluate on device before changing anything.**

The chip differentiates *rating* (LIMITED vs GOOD) at 9pt and 0.55 vs 0.78 opacity, but **the
hero itself is identical** in both cases — same numeral size, same accent, same band word. Static
analysis cannot settle whether that reads as honest or as an unnoticed footnote.

Set up both states and look at them:

1. fresh account, log **one** drink, no wearable → expect **LIMITED**
2. an account with a week of intake and a synced provider → expect **GOOD**

Then answer, on device:

- Is the chip **noticed at all** without being pointed at?
- Does the LIMITED reading feel appropriately hedged, or does the big number still dominate the
  impression?
- Would a member reasonably believe the LIMITED score is as trustworthy as the GOOD one?

**If the chip is sufficient → change nothing.** If it is not, the next lever is softening the
hero numeral itself for thin evidence — a deliberate break from "one dominant number, unchanged"
and therefore a founder decision, not an implementation detail. **Do not redesign from code
reading alone.**

---

## F · Documented visual debt — NOT to be actioned without evidence

Recorded per founder instruction. **Do not start a design wave for these unless device QA shows
one is beta-blocking.**

| Item | Score | Why it is debt | Beta-blocking? |
|---|---|---|---|
| **Two design languages** | — | 12 components on the refined `AFScreen` chrome; **42 still on `GradientBackground`**, including 16 nominally-redesigned V2/V3 screens | ☐ decide on device |
| **Scan** | 5.8 | 1355 lines, old chrome, three co-equal entry paths, fails the three-second and one-action tests — and it is a core loop | ☐ decide on device |
| **Subscription** | 5.3 | never received the experience pass; three plan families, no recommended default, maximum competition — and it is the money path | ☐ decide on device |
| **Onboarding** | 6.0 | got only permission-timing and a11y fixes | ☐ |
| **Profile size** | 6.0 | 3,498 lines — maintenance risk, not a member-visible defect | ☐ |
