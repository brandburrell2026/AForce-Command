# AForce OS — Validation Methodology

Version: v1.0 — April 2026

This document captures every numerical model the AForce OS hydration
engine uses, with the published reference it draws from and the
limitations a sports-science partner needs to know before designing a
real-world validation study.

Each section is structured the same way:

1. **What we compute**
2. **Formula / decision rule**
3. **Reference**
4. **Limitations & known gaps**

---

## 1. Sweat rate (per session)

**What we compute.** Volume of fluid lost during a discrete activity
session, in millilitres per hour (mL · h⁻¹), used to size both the
Hydration Score replenishment target and the post-session AForce
sodium prescription.

**Formula.**

```
sweat_rate_ml_per_h = (pre_weight_kg − post_weight_kg) × 1000
                     + fluid_in_ml − urine_out_ml
                     all divided by duration_h
```

A 1 kg net loss over 1 hour = 1000 mL · h⁻¹.

**Reference.** ACSM Position Stand: *Exercise and Fluid Replacement*,
Sawka et al., Med Sci Sports Exerc 39(2): 377–390, 2007.

**Limitations.**
- Treats every gram lost as water. Glycogen + substrate oxidation can
  account for ~50–100 g · h⁻¹ that isn't actually fluid loss.
- Doesn't model respiratory water loss separately from sweat.
- Assumes accurate scale (±0.1 kg).

---

## 2. Sodium replacement bands

**What we compute.** Per-session sodium target (mg) split into low /
moderate / high bands, used by the AForce prescription engine and the
Sweat Autopilot recovery window to pick stick vs RTD ratios.

**Formula.**

| Sweat sodium | Band     | mg · L⁻¹ losses |
|--------------|----------|----------------|
| Low          | Salty 1  | < 500          |
| Moderate     | Salty 2  | 500 – 800      |
| High         | Salty 3  | 800 – 1200     |
| Very high    | Salty 4  | > 1200         |

Per-session prescription = `sweat_loss_L × band_concentration`, capped
at 2300 mg per 4 h to stay below the upper-limit chronic sodium
recommendation.

**Reference.** Baker LB, *Sweating Rate and Sweat Sodium Concentration
in Athletes: A Review of Methodology and Intra/Interindividual
Variability*. Sports Med 47 (Suppl 1): 111–128, 2017.

**Limitations.**
- Bands assume a healthy adult. Hypertensive users should override.
- Heat-acclimatized athletes drift toward the low band over weeks.
- Genetic variants in CFTR can produce sweat sodium > 1500 mg · L⁻¹
  outside the modelled range.

---

## 3. Heat Index (Heat Guard activation)

**What we compute.** Apparent temperature in °F used to flip the Heat
Guard band from `safe → caution → warning → critical` and adjust
recheck cadence in the scoring engine.

**Formula.** Rothfusz regression (NWS 1990), used at ambient ≥ 80 °F:

```
HI = -42.379 + 2.04901523·T + 10.14333127·R
     - 0.22475541·T·R - 6.83783e-3·T²
     - 5.481717e-2·R² + 1.22874e-3·T²·R
     + 8.5282e-4·T·R² - 1.99e-6·T²·R²
```

with a low-humidity adjustment when `R < 13 % AND 80 ≤ T ≤ 112` and
a high-humidity adjustment when `R > 85 % AND 80 ≤ T ≤ 87`.

**Reference.** Rothfusz LP, *The Heat Index Equation*, NWS Tech.
Attachment SR 90-23, 1990. NWS Heat Index page (current).

**Limitations.**
- Defined for shade; we do not adjust for direct solar radiation.
- Not validated below 80 °F — we suppress Heat Guard entirely when
  ambient < 75 °F.
- Wet-bulb globe temperature (WBGT) is the gold standard for elite
  athletes — Rothfusz is a consumer-friendly approximation.

---

## 4. Estimated blood alcohol concentration (Social Mode)

**What we compute.** Real-time BAC estimate during Social Mode used
for the conservative 0.06 % "drink water" prompt and the 8 h Recovery
Mode window after deactivation.

**Formula.** Widmark equation (refined NHTSA form):

```
BAC% = (alcohol_g / (body_weight_g × r)) × 100
       − β · hours_since_first_drink

r       = 0.68 (male) | 0.55 (female)   Widmark factor
β       = 0.015 % · h⁻¹                 elimination rate (Forrest 1986 mean)
food_r  = ×0.85 multiplier when ate_recently
```

Alcohol grams per drink default = `oz × abv × 0.789 × 29.5735`.

**Reference.** Widmark EMP, 1932 (translation: *Principles and
Applications of Medicolegal Alcohol Determination*, 1981). Forrest
ARW, *The Estimation of Widmark's Factor*, J Forensic Sci Soc 1986.

**Limitations.**
- Population-average factors — actual r ranges 0.49–0.78.
- Elimination rate accelerates with chronic drinking (β can reach
  0.025).
- Gastric absorption rate ignored — we don't model time-to-peak
  (~30–90 min).
- Not a legal BAC. Visual disclaimer is shown in-app.

---

## 5. Recovery & readiness adjustments (Apple Health overlay)

**What we compute.** Up-to-±10 point adjustment to the displayed
Hydration Score based on resting heart rate, HRV (SDNN), and
last-night sleep hours.

**Decision rule (sums clamped to ±10).**

```
delta_rhr   = clamp(  (rhr_today − rhr_baseline) ×  -0.4 , -3, +3 )
delta_hrv   = clamp(  (hrv_today − hrv_baseline) ×  +0.05, -3, +3 )
delta_sleep = clamp(  (sleep_h − 7.5) ×             +1.5 , -4, +4 )

readiness_delta = clamp(delta_rhr + delta_hrv + delta_sleep, -10, +10)
```

`*_baseline` is a 14-day rolling median pulled from HealthKit.

**Reference.** Recovery proxy validated against Whoop / Oura
internal whitepapers; baseline-relative HRV scoring follows Plews et
al., *Heart Rate Variability and Training Intensity Distribution in
Elite Rowers*, Int J Sports Physiol Perform 2014.

**Limitations.**
- Baseline noise is high in the first 14 days of HealthKit history.
- Single SDNN sample is less reliable than RMSSD over 5 min — Apple
  exposes both but only SDNN at-rest is consistent across watches.
- Sleep score only counts duration, not sleep stages.

---

## 6. Per-event hydration impact (the score itself)

**What we compute.** Score delta credited to a single intake event,
broken into immediate + delayed components so the orb visibly fills
over the 20-minute absorption window.

**Decision rule.**

```
base_impact = (oz / 12) × per-fluid_weight × flavor_multiplier
            × (heat_guard_active ? 1.15 : 1.0)

cap_adjusted = min(base_impact, 12)        # 20-min absorption cap

immediate    = cap_adjusted × 0.40         # released at log time
delayed      = cap_adjusted × 0.60         # eased over 20 min
```

`per-fluid_weight`: water 0.9, AForce stick 1.4, AForce RTD 1.3,
canister 1.2. Flavor: watermelon 1.05, berry 1.05, soursop 1.10
(and a +1 bonus when scoreBefore < 60), unflavored 1.0.

**Reference.** Internal model — calibrated from pilot field data
(n=42, summer 2025). NOT yet peer-reviewed.

**Limitations.**
- The 20-min cap is a UX choice (so users see progress quickly), not a
  physiological constant.
- Caffeine, electrolyte content of competitor drinks, and oral
  rehydration solution coefficients are not modelled in v1.

**Founder Decision — v1 Launch Stance (resolved 2026-06-01).**
The per-event hydration scoring model (n=42, summer 2025) is approved for v1
App Store launch under the following conditions:

1. The score is presented as a relative performance indicator, not a clinical
   hydration measurement. Language across all surfaces must reflect this —
   "your readiness score" not "your hydration level."
2. The health disclaimer screen (`app/legal/health-disclaimer.tsx`) must be
   shown on first launch, before the orb is visible. No exceptions.
3. HydroScan results are advisory only. The word "recommendation" is permitted.
   The word "prescription" is not.
4. A peer-review validation study (n≥30, standardized protocol per Section 7)
   is targeted for completion before Series A close. Results will be used to
   recalibrate scoring coefficients in v1.1.
5. Any marketing claim referencing the scoring engine must be reviewed against
   this methodology before publication. The CMO and founder must both sign off.

This decision is final for v1. It is logged here as the authoritative record.

---

## 7. Compliance streak & retention

**What we compute.** Day count of consecutive "command followed"
days, used by the consistency term in the scoring engine and as the
unlock criterion for the streak achievement family.

**Decision rule.** A day "counts" when both:

1. The user opened the app at least once between 06:00–22:00 local.
2. `confirmed_count_for_day / commands_for_day ≥ 0.6`.

A miss-day that is followed by 3 consecutive hit-days restores 50 %
of the lost streak (the "comeback" rule).

**Reference.** Self-determination theory streak heuristics, Ryan &
Deci 2000. Behavioural-design "loss-aversion light" pattern, Eyal
*Hooked* 2014.

**Limitations.**
- Time-zone changes during travel can lose a day.
- Sleep-shifted users (graveyard-shift workers) need a custom
  06:00–22:00 window.

---

## How to validate this in the field

To convert this from an internal model into a study-ready protocol:

1. **Sweat rate / sodium.** Recruit n ≥ 30 athletes, collect
   absorbent-patch sweat (forearm + back) during a standardized
   45-min cycling bout at 65 % VO₂max in 32 °C / 50 % RH. Compare
   patch-derived sweat sodium to the band our app would have assigned.
2. **Heat Index.** Co-locate a WBGT meter for 14 outdoor sessions
   spanning 70–105 °F. Plot Rothfusz-HI vs WBGT — quantify the gap
   for the user's region.
3. **BAC.** Single-blind n ≥ 12 alcohol-challenge with breathalyser
   ground truth at +30 / +60 / +120 min. Report MAE for our Widmark
   estimate.
4. **Score validity.** A 4-week diary study comparing self-reported
   thirst / mood / urine colour to the displayed score. Look for
   monotonicity, not absolute calibration.

Open questions are tracked in `replit.md` under "Validation gaps".
