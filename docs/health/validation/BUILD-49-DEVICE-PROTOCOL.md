# Build-49 Device Verification Protocol — Apple Health pipeline

**For:** Brandon, iPhone 17 Pro + paired Apple Watch, real Health data.
**Build:** the internal-TestFlight EAS profile (`EXPO_PUBLIC_INTERNAL_TESTFLIGHT=true`) — this is
what enables both live HealthKit and the diagnostics panel this protocol reads from. If you don't
see "INTERNAL DIAGNOSTICS · APPLE HEALTH" on the Profile screen after step 1, you're on the wrong
build; there is no in-app toggle for this, it's baked in at build time.
**Time:** ~15–20 minutes.
**What this settles:** which of three step totals is correct (Gate 3), whether the sleep fix is
needed on a real night, whether HRV/RHR match the Health app, whether freshness text is honest, and
whether the score actually moves. Every question below has an explicit PASS/FAIL line — don't
eyeball it, write the number down.

Keep the **Health app** open in the background the whole time (swipe between it and AForce) — you
are comparing two apps' numbers against each other, not just reading AForce in isolation.

---

## 0. Setup (2 min)

1. Open AForce → Profile. Confirm you're connected to Apple Health (if not, connect now, grant all
   six permissions when prompted — you should see exactly 6 read toggles and 0 write toggles; if
   you see a write/share toggle, stop and flag it, that's a regression).
2. Scroll to "Live from Apple Health" and tap **Refresh**. Wait for it to finish.
3. Tap "INTERNAL DIAGNOSTICS · APPLE HEALTH" to expand the panel. You'll read specific rows from
   here in every step below.
4. Open the Health app in the background so you can flip to it quickly.

---

## 1. Steps — which of the three numbers is real? (THIS IS GATE 3) (5 min)

1. In the Health app: Browse → Steps → today. Note the exact number at the top.
2. In AForce's diagnostics panel, under "Steps today — old vs. new aggregation," write down all
   three numbers:
   - **raw sum (old):** _______
   - **bucketed max (new):** _______
   - **native merged (HK's own):** _______
   - Health app's number: _______

**PASS/FAIL and what each outcome means — decide before you compare, then match:**

- **If "native merged" matches the Health app most closely** → flip the selection.
  `stepsToday`'s assignment in `services/appleHealth.ts` (currently `stepsUsedFallback ?
  stepsRawSampleSum : stepsBucketedMax`) changes to select `stepsNativeMerged` instead of
  `stepsBucketedMax`. This is a one-line, evidence-driven change — do not make it without this
  reading.
- **If "bucketed max" matches (or is closer than the other two)** → no change. Record this reading
  as the confirmation the current selection is correct, so it doesn't get re-litigated without new
  evidence.
- **If none of the three match** → this is a fourth, currently-unknown problem. Do not guess a
  fix — capture all three numbers plus the Health app's number and the exact time of day, and flag
  it for engineering with those four numbers. (Likely candidate per the code's own documented
  limitation: if you used your Watch for part of the day and your phone for another part within the
  *same clock hour*, the bucketed-max method can under-count that specific hour — check whether the
  mismatch is small and hour-boundary-shaped before treating it as a bigger bug.)

Also check the "per-source totals" list beneath — if you wore both Watch and phone today, you
should see two source rows (e.g. "iPhone" and your Watch's name) with different totals. If you only
carried one device today, one row is expected and this comparison is less conclusive — repeat this
test on a two-device day if today was single-device.

---

## 2. Sleep — does last night match the Health app? (5 min)

1. In the Health app: Browse → Sleep → last night's card. Note the "Time Asleep" figure (not "Time
   in Bed" — those are different numbers).
2. In AForce's diagnostics panel, under "Sleep last night," read:
   - **query window:** the two timestamps shown — note whether the start time is *before* or
     *after* the time you actually fell asleep last night. If your window's start time is AFTER
     when you fell asleep, that is the known 18-hour-window truncation bug (see below) —
     write down what time you actually fell asleep for comparison.
   - **interval union (new):** _______ h
   - **value used:** _______ h
   - Health app's "Time Asleep": _______ h

**PASS:** "value used" is within ~10–15 minutes of the Health app's figure (rounding/boundary
differences at this scale are expected and not a bug).

**FAIL, and which bug it is:**
- If the query-window start time is later than when you actually fell asleep AND "value used" is
  noticeably short of the Health app's number → this is the **known, currently-open 18-hour
  window-truncation bug** (documented in `BUILD-50-CORRECTNESS-LEDGER.md`). Do not file this as a
  new bug — a fix is already being built. Just confirm the symptom and note the shortfall in hours.
- If the window comfortably covers your actual bedtime but the number is still off by more than
  ~15 minutes → this is a **new** finding, not the known bug. Note the "selection branch" row
  value and the per-source totals list underneath (which device recorded what) and flag it with
  those details.

---

## 3. HRV and resting heart rate — sample vs. average (4 min)

1. In the Health app: Browse → Heart → Heart Rate Variability. Note today's HRV number as
   displayed (this is typically an average or the most recent reading — note which one the Health
   app itself labels it as).
2. Do the same for Browse → Heart → Resting Heart Rate.
3. In AForce's diagnostics panel, read the "HRV (SDNN)" and "Resting heart rate" sections:
   - HRV **value used:** _______ ms, **newest sample** line's timestamp: _______
   - RHR **value used:** _______ bpm, **newest sample** line's timestamp: _______
   - HRV **samples / 24h:** _______, RHR **samples / 24h:** _______

**PASS/FAIL:**
- If AForce's "value used" matches the Health app's displayed number closely → the most-recent
  -sample approach happens to agree with the Health app today; note it, but don't treat one
  matching day as proof — HRV/RHR are typically computed once or twice a day, so try this again on
  a different day if possible.
- If they diverge, check "samples / 24h" first: **0 or 1 sample** means there's genuinely nothing
  newer for AForce to show — that's HealthKit behaving correctly, not a bug (the Health app may be
  showing yesterday's reading too, or an average that includes readings AForce's "most recent"
  logic doesn't surface the same way). **Several samples in 24h AND still diverging** from the
  Health app's number is the more informative case: this is the standing "most-recent-sample vs.
  daily-average" semantics question. Write down both numbers and the sample count — this is exactly
  the evidence a founder ruling on that semantics question needs, not something to fix yourself.

---

## 4. Freshness — does the text mean "observed" or "synced"? (3 min)

1. Pick whichever of HRV or RHR had the OLDER "newest sample" timestamp from step 3 (ideally more
   than a few hours old — if both are very recent, wait a few hours and re-run this step later
   today).
2. Tap Refresh in AForce again right now.
3. In the diagnostics panel, under "Scoring input," read **"latest observed at"** and compare it to
   the older sample's timestamp from step 3.
4. Look at whatever freshness/staleness text AForce shows elsewhere on the Profile or Home screen
   for Apple Health (e.g. "synced Xm ago," "stale," etc.).

**PASS:** "latest observed at" matches the real HealthKit sample time from step 3 (not "just now,"
even though you just tapped Refresh) — this proves the observation-time axis is real and distinct
from sync time. If any user-facing staleness label uses "observed at" and correctly reads as stale
despite the fresh tap-triggered sync, that confirms the whole chain end-to-end.

**FAIL:** if "latest observed at" reads as the current time (i.e., it moved to "now" just because
you tapped Refresh, even though the underlying sample is hours old) — that would mean the
observation-time fix regressed. This has not been observed in code review, but this is the specific
device check that would catch it if it did.

---

## 5. Does the score actually move? (3 min)

1. Note the current Home score and open the score breakdown sheet; find the health-platform row
   (labeled "Health platform (HRV / sleep / strain)" for a single connected provider — it will NOT
   say "Apple Health" literally, that's expected, not a bug) and note its delta value.
2. Do something that changes an Apple Health number AForce actually scores on — the two real levers
   are HRV and sleep (steps only affects the activity floor, not this row — don't use steps to test
   this). The simplest real trigger: wait until your Watch or phone records a new HRV reading
   (happens periodically through the day, often tied to Background/Sleep readings), or use this
   tonight after a new night's sleep is recorded.
3. Refresh AForce, re-open the breakdown sheet, and re-read the same row's delta.

**PASS:** the delta value changes (or the underlying HRV/sleep number shown in the diagnostics
panel's "value used" rows changes) after a genuinely new HealthKit sample lands. A single test
where nothing new was recorded and nothing moved is NOT a fail — HealthKit correctly returns the
same value when there's nothing new to report (this is a documented, expected trait, not a bug —
see `AppleHealthRefreshControl.tsx`'s own header comment on this).

**FAIL:** a value visibly changed in the diagnostics panel's "value used" row (proving new data
arrived) but the breakdown sheet's delta and/or the Home score did not change at all. That would be
a real plumbing break between `aggregateBiometrics` and the rendered score — capture both the
before/after diagnostics panel screenshots and the before/after breakdown sheet screenshots.

---

## Reporting back

For each of the 5 sections above, you need exactly one of: a PASS, a specific FAIL with the numbers
that back it up, or (for section 1) the fourth-case numbers if none of the three step totals match.
Screenshots of the expanded diagnostics panel for each section satisfy "the numbers that back it
up" — you don't need to type them out separately if you have the screenshot.
