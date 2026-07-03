# AFORCE OS — Architecture Specification (Version 1)

**Status:** Consolidated master specification. Version 1 architecture is locked after Sections 53–57. No new branded systems beyond what is specified here.

**Authority note:** This document consolidates the implementation emails provided by Julius Burrell. It is a single working reference for implementation. The earlier specifications referenced throughout ("keep every previous specification exactly as written") remain the source of truth where they are not reproduced here; this consolidation does not replace them. Where an earlier spec is referenced but its full text was not provided, it is marked **[REFERENCED — not reproduced here]**.

**Core principles (apply to every section):**
- Nothing operates independently. Every intelligence engine feeds the **Evidence Engine™**.
- Every recommendation remains **Water-First**.
- **Body first, product last.** Every recommendation is earned through intelligence, never sold — see *Product Positioning Principle* below. Applies across the entire AForce ecosystem, including Phantom Band™ and Meridian™.
- Every recommendation updates **Performance Memory™**.
- Every recommendation increases personalization over time via the **Adaptive Performance Profile™**.
- Never diagnose. Never compare one user to another or to population averages once sufficient personal data exists.
- Keep every threshold configurable in `config/hydroStateModel.ts`. Never hardcode formulas.
- Build one numbered section at a time. Confirm completion and run tests before continuing.
- **Performance Is Non-Negotiable.**

---

## Master Architecture — Engine Flow

Everything flows through this order. Every engine supports the next; no engine operates independently.

1. Adaptive Performance Profile™
2. Global Adaptation Engine™
3. Climate Profile™
4. Environmental Pressure™
5. Sleep Readiness Intelligence™
6. Tomorrow Load Forecast™
7. HydroState™
8. Evidence Engine™
9. Command Confidence™
10. Today's Command
11. Performance Memory™
12. Performance Age™

Meridian™ is the intelligence layer that consumes the engines, decides, and routes through Evidence Engine → Command Confidence → AutoPilot for delivery.

---

## Product Positioning Principle — Body First, Product Last

**The body comes first. The recommendation comes second. The product comes last.**

AForce OS must never feel like it is trying to sell products. Every recommendation is earned through intelligence, in this exact order:

1. **HydroState™ determines what the body needs first.**
2. **The Evidence Engine™ explains why.**
3. **Only then does the Command Engine recommend the best solution.**

If an AForce product is the best match, the OS recommends it because it fits the user's current needs — **not because it is our product**. When no product is needed, the OS says so.

**Example — Today's Command:**

> • Drink 16 oz water.
> • Replace electrolytes.
> • Recheck in 90 minutes.
>
> **Recommended Option:** AFORCE Watermelon Surge — optimized for today's hydration and heat conditions.

The recommendation follows the need; it never leads. This builds trust instead of feeling like advertising.

**Ecosystem scope.** This principle governs the entire AForce ecosystem. **Phantom Band™** and **Meridian™** inherit it without exception: the user should *discover why* they improve the experience rather than feeling sold to. **Section 36 — Trust Principle™** is the HydroScan-specific instance of this now-global principle.

*This is a positioning-principle clarification, not a new branded system — consistent with the V1-locked status.*

---

# PART A — ADAPTIVE PROFILE & RECALIBRATION

## Section 18 — Adaptive Profile Engine™ / Adaptive Performance Profile™

The user-specific calibration layer for AForce OS. Its purpose is to keep every intelligence engine aligned with the user's current physiology, environment, habits, and goals. The profile is never static — as the user changes, the OS changes.

It calibrates: HydroState™, Sleep Readiness Intelligence™, Climate Profile™, Environmental Pressure™, Recovery Window™, Tomorrow Load Forecast™, Performance Age™, Command Confidence™, Performance Memory™, Evidence Engine™, Oral Hydration Signal™, and Skin Performance Intelligence™.

The OS must continuously adapt while preserving historical performance records: body, weight, body composition, fitness, climate, routine, sleep, and goals all evolve over time.

### Core Rule — Profile Versioning™

Every meaningful profile change creates a new **Profile Version™**.

- Profile v1 — 260 lbs
- Profile v2 — 248 lbs
- Profile v3 — 235 lbs

Performance Memory™ always remembers which Profile Version was active. Historical performance is never overwritten. Historical baselines are never deleted. Evidence Engine™ must explain every recalibration.

> "Your hydration targets were recalibrated because your body weight changed from 260 lbs to 248 lbs. Future recommendations now use your updated profile."

### Editable Profile

Users may update: Weight, Height, Age, Sex, Activity Level, Training Level, Performance Goal, Goal Weight, Home Climate, Home Location, Wake Time, Sleep Time, Typical Caffeine Use, Sweat Classification, Connected Wearables, AForce Product Preference, Hydration Preference.

Reserve future fields for: Nutrition, Medications, Travel Preferences.

Every update receives a timestamp.

### Profile Update Screen

- **Headline:** UPDATE YOUR PERFORMANCE PROFILE
- **Body:** "Your body changes. Your baseline should change with it. Keep your profile current so AForce OS stays calibrated to your performance."
- **Sections:** Body, Sleep, Training, Recovery, Hydration, Climate, Wearables, AForce Products
- **CTA:** SAVE PROFILE UPDATE

**On Save:** create a Profile Version when major variables change; preserve historical data; recalculate future targets; update Evidence Engine; display recalibration confirmation.

> "Your Performance Profile has been updated. Future recommendations will use your new baseline while preserving your performance history."

### Major Profile Variables (create a new Profile Version™)

Weight, Height, Age Bracket, Sex, Activity Level, Training Level, Performance Goal, Home Climate, Significant Sleep Schedule Change, Sweat Classification, Connected Wearables.

Minor preference updates do not create a new version.

### Hydration Recalibration

When major profile variables change, HydroState recalculates: Daily Water Target, Electrolyte Timing, Sweat Loss Estimate, Recovery Window™, Environmental Pressure™ sensitivity, Sleep Readiness Intelligence™, Tomorrow Load Forecast™, Climate Profile™ modifiers, Performance Age™ interpretation, Command Confidence™ weighting. All calculations remain configurable in `config/hydroStateModel.ts`. Never hardcode formulas.

### Weight Journey Support

If Weight Loss is a goal, HydroState recognizes progress without judgment.

> "You are 12 pounds below your original baseline. Your hydration profile has been recalibrated to match your current physiology."

Rules: never shame users; never compare users; never compare to population averages; never display medical advice; always explain changes as performance calibration.

### Baseline Recalibration

Major profile updates never erase the existing baseline. Instead: archive previous baseline; begin collecting the next baseline; temporarily lower confidence; increase confidence as new observations accumulate; Evidence Engine explains the transition.

> "Your Performance Profile has changed. HydroState is building your updated baseline. Confidence will increase as more observations are collected."

### Database Requirements

Create or extend: `UserProfile`, `ProfileVersion`, `BaselineVersion`, `HydroStateBaseline`, `ClimateProfile`, `PerformanceMemory`, `ProfileChangeLog`.

- Every HydroState record stores: `profileVersionId`, `baselineVersionId`.
- Every Performance Memory™ record stores: `profileVersionId`, `baselineVersionId`.

### User Control

Users may: Edit Profile, View Current Profile Version, View Last Calibration Date, Request Baseline Reset, Disconnect Wearables, Update Goals, Update Climate, Update Weight, Update Training Level. No customer support should ever be required to update a profile.

### Claude Code Implementation Rules

Adaptive Profile Engine™ becomes the calibration layer for every intelligence engine. No new navigation tabs. Add Profile Update inside the existing Profile or Account area. Implement Profile Versioning™. Preserve historical data; never overwrite historical baselines. Recalculate future recommendations after major updates. Temporarily reduce confidence after recalibration. Evidence Engine™ explains every profile-driven adjustment. Store `profileVersionId` and `baselineVersionId` across HydroState™ and Performance Memory™. Keep every threshold configurable in `config/hydroStateModel.ts`. Never compare users with other users or population averages. Always frame recalibration as performance optimization — not correction.

## Section 19 — Performance Profile™ (Onboarding Expansion)

Expand onboarding with:

- **Training Level:** Beginner, Active, Advanced, Elite
- **Primary Goal:** Fat Loss, Lean Performance, Strength & Muscle, Performance Maintenance, Endurance, Recovery Optimization, Everyday Energy
- **Additional fields:** Current Weight, Goal Weight, Height, Age, Typical Workout Duration, Typical Sweat Level, Occupation

HydroState uses these as part of the user's personal baseline.

## Section 20 — Body Recalibration Engine™

Whenever the user changes physically, HydroState recalculates: Daily hydration target, Electrolyte recommendation, Recovery timing, Recheck intervals, Environmental modifiers. Historical data never changes — only future intelligence updates.

---

# PART B — HYDROSTATE INTELLIGENCE LAYER

HydroState™ uses **Personal Baseline™** as its foundation. All new signals feed HydroState through the **Signal Weighting Engine**. No visual observation ever creates a command directly — everything passes through HydroState → Evidence Engine → Command Confidence.

## Section 21 — Sleep Readiness Intelligence™

Sleep is connected to hydration. HydroState combines: Sleep duration, Sleep consistency, HRV, Resting heart rate, Overnight hydration loss, Environmental Pressure™, Climate Profile™. Instead of simply reporting sleep, HydroState prepares the user before decline.

> "You likely lost more hydration overnight than normal. Begin today with water before caffeine."

## Section 22 — Tomorrow Load Forecast™

HydroState predicts tomorrow's hydration demand using: Calendar, Workout schedule, Weather, Temperature, Humidity, UV, Recovery, Sleep, Recent hydration consistency, Climate Profile™.

Outputs: Low, Moderate, High, Extreme. The goal is preparation before depletion.

## Section 23 — Hydration Resilience Score™

Hydration is measured across time, not only today. Evaluates: Recovery speed, Heat adaptation, Daily consistency, Environmental adaptation, Electrolyte consistency, Sleep recovery, Long-term hydration stability. This becomes a long-term performance metric.

## Section 24 — Oral Hydration Signal™

Expand HydroState beyond skin. Observe: Dry lips, Lip cracking, Mouth dryness, Sticky mouth, Tongue moisture, Overnight mouth dryness, Recovery after hydration. These signals compare only against the user's baseline. They never create recommendations by themselves.

## Section 25 — Advanced Visual Intelligence™ (Skin Performance Intelligence™)

> **⚠️ COMPLIANCE GATE — CAMERA SURFACE FLAGGED OFF.** This section involves camera-based observation of the user's face to infer hydration state. The engine/data layer (baseline storage, signal weighting, Evidence Engine wiring) may be built now, but the **camera capture surface must remain behind a feature flag and disabled in production until legal/regulatory review is complete** (biometric-data law, Apple health/camera privacy review, medical-claims review). This matches the prior decision to keep the HydroState camera surface dark pending legal review. Do not enable face capture for beta without that sign-off.

Expand HydroState Visual Intelligence to monitor recovery over time. Supported observations: Skin hydration, Skin moisture retention, Skin texture, Skin brightness, Skin barrier recovery, Dry skin trends, Dehydration trends, Environmental stress, Heat stress, UV stress, Under-eye fatigue, Periorbital recovery, Lip hydration, Facial recovery patterns.

Every observation compares only against the user's own baseline. Never compare users to population averages. Observation only. Never diagnose.

## Section 26 — Personal Adaptive Learning™

HydroState learns how each individual responds: Water response, Electrolyte response, Heat response, Workout response, Recovery response, Sleep response, Climate response. Recommendations become increasingly personalized over time.

## Section 27 — Performance Drift™

Performance changes gradually. HydroState continuously tracks movement toward or away from the user's personal best baseline. States: Improving, Stable, Early Drift, Declining. The Evidence Engine™ explains what is driving the trend before noticeable performance loss occurs.

**Implementation note (Sections 21–27):** These extend the existing HydroState architecture. No new navigation. No redesign of the current UI. Every new feature feeds the Evidence Engine™. Every recommendation remains Water-First. Every visual observation compares only to the user's personal baseline. Never diagnose. Keep all thresholds configurable in `config/hydroStateModel.ts`.

---

# PART C — HYDROSCAN: PERFORMANCE DECISION INTELLIGENCE

HydroScan™ is no longer a drink scanner. It becomes AForce OS's **Performance Decision Intelligence Engine**.

## Section 28 — Performance Decision Intelligence™

HydroScan does not rate products. It evaluates how a product fits the user's current performance state. Every scan combines: Adaptive Profile™, HydroState™, Performance Memory™, Sleep Readiness Intelligence™, Environmental Pressure™, Climate Profile™, Recovery Window™, Tomorrow Load Forecast™, current goals, current activity, and wearable data when available. The recommendation is always personalized.

## Section 29 — Scan Anything™

Support: Water, Coffee, Tea, Energy drinks, Sports drinks, Electrolytes, Alcohol, Protein drinks, Protein powders, Pre-workouts, Post-workout recovery products, Smoothies, Juice, Supplements, Functional beverages, International beverages.

Input methods: Barcode, Nutrition label scan, Supplement Facts scan, OCR ingredient scan, Manual search, Manual entry. If the product exists, HydroScan should attempt to understand it.

## Section 30 — Performance Fit™

Replace generic product scoring with **Performance Fit™** — how well today's product matches the user's current performance state.

> Performance Fit™ 91 / 100 — Today's Context: HydroState™, Sleep, Heat, Workout schedule, Recovery, Goals.

Tomorrow, the same product may receive a completely different Performance Fit because the user's context has changed. Never rank products globally. Always personalize.

## Section 31 — Decision Confidence™

Every recommendation includes a confidence level depending on: Complete product information, Active wearable signals, Profile completeness, Lighting quality (visual scans), Current environmental data, Historical learning. Levels: High Confidence, Moderate Confidence, Limited Confidence. Never pretend certainty when data is incomplete.

## Section 32 — Product Strengths & Today's Considerations™

Never describe products as "good" or "bad." Instead show **Strengths**, **Today's Considerations**, **Next Best Action**.

> Strengths: Supports hydration after prolonged activity.
> Today's Considerations: Current conditions suggest beginning with water first.
> Next Best Action: Drink 16 oz of water now. Recheck HydroState in 60 minutes.

Maintain a helpful, educational tone.

## Section 33 — Recovery Intelligence™

After every scan ask: "Would you like to optimize around this decision?" Recovery plans adapt automatically (Coffee → water first; Alcohol → alternate hydration; Workout → recovery hydration timing; Travel → Recovery Window adjustment). Never criticize the user's decision. Always optimize around it.

## Section 34 — Decision Memory™

Every scan becomes part of Performance Memory™. The system learns personal hydration, caffeine, alcohol, heat, recovery, and workout responses.

> "Historically, beginning your mornings with water before caffeine has produced your highest HydroState scores."

Recommendations become more personalized over time.

## Section 35 — HydroScan Integration Rule™

HydroScan must update: HydroState™, Evidence Engine™, Performance Memory™, Command Confidence™, Recovery Window™, Tomorrow Load Forecast™, AutoPilot™ (when enabled), Guardian™, Cruise™, Clutch™, Adaptive Profile™, Global Adaptation Engine™. HydroScan is one intelligence layer within AForce OS, not an isolated feature.

## Section 36 — Trust Principle™ (non-negotiable)

HydroScan never attempts to sell AForce — it earns trust. Never automatically recommend AForce. Recommend the best action for the user's current state. Water remains first whenever appropriate. If no action is needed, say so. If another product fits the user's situation, acknowledge its strengths honestly. When AForce is recommended, the recommendation must be supported by the user's data and current context — not because it is our product. Users should feel they are receiving objective performance guidance, not advertising. *This is the HydroScan-specific instance of the ecosystem-wide Product Positioning Principle — see "Product Positioning Principle — Body First, Product Last" near the top of this document.*

## Section 37 — Global HydroScan™

HydroScan operates globally: Local languages, Local nutrition labels, Regional barcode databases, Local units, Local weather, Local products, International beverages. Recommendations remain personalized regardless of country.

---

# PART D — ENGAGEMENT, SHARING & RETENTION

The objective is to make AForce OS something users naturally return to and naturally share.

## Section 47 — Performance Sharing™

Generate premium, branded share cards for: Weekly Progress, 30-Day Performance Blueprint™, 60-Day Blueprint™, 90-Day Blueprint™, Annual Year in Performance™, Performance Milestones™. Never expose Weight, medical information, or private health data. Sharing is always optional.

## Section 48 — Performance Referral™

Every shared card includes: "Generated with AFORCE OS", a personalized referral link, a QR code, and referral tracking (e.g. `drinkaforce.com/invite/username`). Every successful referral becomes part of Performance Memory™ and Referral Intelligence™.

## Section 49 — Year in Performance™

Once per year, generate a personalized summary: Hydration consistency, Recovery improvements, Environmental adaptation, Performance milestones, Personal discoveries, Strongest habits, Greatest improvements. Users may save or share it.

## Section 50 — Performance Status™

A simple system status screen: HydroState Confidence, Signals Connected, Profile Status, Camera Baseline Status, Last Sync, Weather Status, Sleep Status. Users should always understand how complete their Performance Engine is.

## Section 51 — Privacy Center™

Full user control: Delete scans, Download personal data, Manage stored information, Disable camera analysis, Disconnect wearables, Manage permissions, Control AI coaching preferences. Privacy becomes part of the product experience.

## Section 52 — Explainability Center™

Extend the Evidence Engine™. Allow users to ask "Why did I receive this recommendation?" The OS explains recommendations in simple language using the user's own data. Transparency increases trust.

---

# PART E — VERSION 1 REFINEMENTS (LOCK)

Implementation refinements only — no new user-facing systems, navigation, or branded engines. After Sections 53–57, Version 1 is locked.

## Section 53 — Data Freshness™

Integrate into the Evidence Engine™. Every recommendation internally validates how current its supporting data is (weather, sleep sync, HydroScan, profile age, camera baseline, wearable sync) before Today's Command is generated. Data freshness improves confidence. No separate screen — surface only when it improves transparency.

## Section 54 — Signal Quality™

Expand HydroState Confidence™. Every signal receives an internal quality rating: Excellent, Good, Limited, Unavailable. Signals include Water Intake, HydroScan™, Camera, Sleep, Heart Rate, HRV, Weather, Climate Profile™, Environmental Pressure™, Apple Watch, Garmin, Samsung, WHOOP, Oura, and future Phantom Band™. If one signal becomes unavailable, HydroState automatically redistributes weighting across remaining validated signals. Recommendations should never fail because one signal is unavailable.

## Section 55 — Profile Completeness™

Integrate into the Adaptive Profile Engine™. Quietly monitor whether important fields are complete (Weight, Goal Weight, Height, Age, Sex, Activity Level, Training Level, Primary Goal, Climate, Sweat Classification, Sleep Schedule, Hydration Goal, Connected Wearables, AForce Product Preferences). Never require every field. Occasionally explain: "Completing your profile helps AForce OS generate more personalized recommendations." Completeness naturally improves HydroState Confidence over time.

## Section 56 — Universal Personalization™

Every recommendation from HydroState™, HydroScan™, AutoPilot™, Guardian™, Cruise™, Clutch™, Sleep Readiness™, Recovery Window™, Tomorrow Load Forecast™, Performance Identity™, and Evidence Engine™ must calibrate using: Age, Height, Weight, Sex, Activity Level, Training Level, Primary Goal, Sweat Classification, Climate Profile™, Environmental Pressure™, Performance Memory™, Adaptive Profile™, Profile Version, Travel Status, Connected Wearables, and future Phantom Band™. Personal Baseline™ always takes priority over generalized population averages once sufficient personal data exists. Every recommendation remains fully personalized regardless of age, body type, country, climate, travel status, or connected devices.

## Section 57 — Performance & Battery Optimization™

Battery efficiency is a core product quality requirement. Minimize background activity; batch network requests; reduce GPS polling when location is stable; respect Low Power Mode; pause non-essential processing at critically low battery while maintaining Today's Command, reminders, and essential notifications; increase update frequency only during active workouts or when AutoPilot™ needs accuracy, then return to efficient operation; update weather intelligently rather than continuously; activate camera analysis only on request or during scheduled scans; sync wearables efficiently rather than continuously polling. Optimization should remain invisible to the user — premium performance with minimal battery impact.

**After Sections 53–57 are complete, the Version 1 architecture is officially locked.**

---

# PART F — GLOBAL ADAPTATION & OPERATING MODES

These integrations connect the systems already built so they operate as one intelligent OS. Do not redesign anything.

## Global Adaptation Engine™

The calibration layer for the entire OS — not a tab or a mode. It quietly adjusts every recommendation based on: Language, Country, Climate, Time Zone, Units, Travel, Regional Weather, Product Availability, Privacy Rules, Local Daily Rhythm. The user should feel AForce OS was built for their country.

## Performance Culture Layer™

A learning layer that adapts to how each individual lives — never assumptions based on nationality. Examples: Early Morning Performer, Night Shift, Frequent Traveler, Office Professional, Outdoor Worker, Parent, Student, Tactical Operator. AForce OS adapts to personal rhythm, not stereotypes.

## Operating Modes

### Guardian™ — always-on protection layer
Continuously monitors HydroState™, Environmental Pressure™, Sleep Readiness Intelligence™, Recovery Window™, Performance Drift™, Tomorrow Load Forecast™, Oral Hydration Signal™, Heat Stress, Sun Recovery Mode™, UV, and Altitude. Intervenes only when meaningful action is needed and confidence is high — preventing decline before it happens. Never create unnecessary alerts.

> "Environmental pressure is increasing. Begin hydrating now."
> "Tomorrow's workload is unusually high. Prepare tonight."

### Cruise Mode™ — automatic maintenance
When HydroState is stable, Cruise quietly manages water reminders, recovery timing, environmental and weather adjustments, Climate Profile, travel adjustments, and daily hydration rhythm. Adapts using Climate, Location, Time Zone, updated Profile, and Environmental Pressure with no extra notifications or setup. Users feel the OS running in the background.

### Clutch™ — high-demand preparation
Activates only during high-demand situations: Competition, Intense workouts, Heat exposure, Long travel, High Environmental Pressure, Low HydroState, Poor sleep, High-stress days. Temporarily increases monitoring frequency, reminder priority, recovery guidance, hydration timing, and Evidence Engine explanations. Adjusts using Tomorrow Load Forecast™, Sleep Readiness™, Environmental Pressure™, Performance Drift™, Travel Mode™, and Climate Profile™. Returns to Cruise Mode automatically when recovery is complete.

### Voice Mode™ — fully localized
Understands every intelligence engine and supports user language, local units, local terminology, local time, and local climate explanation. Users can ask: "How hydrated am I?", "What should I drink?", "Why did my score change?", "What should I do before tomorrow?", "How much water do I need today?", "Why is Guardian warning me?" Responses always use the Evidence Engine so users understand the reasoning.

### AutoPilot™ — the orchestrator
Coordinates Guardian, Cruise, Clutch, HydroState, Sleep Readiness, Environmental Pressure, Climate Profile, Recovery Window, Tomorrow Load Forecast, Voice Mode, and Performance Memory. Always uses local language, units, weather, climate, time, Travel Mode, updated Profile, and Environmental Pressure. The user should feel one intelligent OS is working for them, never that they are managing multiple systems.

## Phantom Band™

Do not change Phantom Band architecture. Ensure it automatically benefits from Global Adaptation, Travel Mode, Local Time, Local Language, Environmental Pressure, and Adaptive Performance Profile. The app should already be ready when Phantom Band launches.

## Meridian™ — the intelligence layer

Consumes HydroState™, Sleep Readiness™, Adaptive Profile™, Climate Profile™, Environmental Pressure™, Tomorrow Load Forecast™, and Performance Drift™. Meridian decides; Evidence Engine explains; Command Confidence prioritizes; AutoPilot delivers.

---

# Final Engineering Rules

- Nothing operates independently. Everything feeds the **Evidence Engine™**.
- Everything ends with a **Water-First Command™**.
- Everything is **body first, product last** — recommendations are earned through intelligence, never sold (*Product Positioning Principle*; ecosystem-wide, including Phantom Band™ and Meridian™).
- Everything is personalized through the **Adaptive Performance Profile™**.
- Everything is calibrated through the **Global Adaptation Engine™**.
- Everything is remembered by **Performance Memory™** (never overwrite historical data).
- Everything improves **Performance Age™**.
- Everything is prepared by **Meridian™**.
- Keep every configurable value in `config/hydroStateModel.ts`.
- Build one numbered section at a time; confirm and test before continuing; do not refactor completed architecture unless required to support a later section.
- Keep the UI clean — simplicity over additional controls. Every screen premium, every recommendation personal.
- If a feature does not improve the user's confidence or performance, remove it.

**After all sections are complete, shift into optimization mode:** speed and responsiveness, smooth animations, excellent mobile experience, stable architecture, battery efficiency, fast startup, reliable offline behavior where possible, edge-case testing, accurate calculations, clear Evidence Engine explanations, consistent visual design. No additional architecture unless validated through beta testing and real user behavior.

**Performance Is Non-Negotiable.**

---

*Consolidated from implementation emails by Julius Burrell. Prepared for the AForce OS engineering workflow.*
