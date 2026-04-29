# AForce OS — Glossary of Terms

**Companion to:** `aforce-os-engineering-brief.md`
**Audience:** Outside counsel and technical reviewers
**Date:** April 29, 2026

This glossary defines every product, code, and physiological term that appears in the engineering brief. Definitions are tied to the running implementation; cross-references in **bold** point to the brief section that uses the term.

---

## A

**AForce OS.** The mobile application built in `artifacts/aforce-os/`. Expo / React Native, served at `/` in development and to be published as the AForce iOS / Android app. The "OS" in the name refers to the role the app plays for the user — a continuous performance operating system, not a logging journal. **(§1)**

**AForce serving / unit.** One physical AForce dose, defined as 12 oz of finished beverage. May be delivered as a Ready-to-Drink (RTD) bottle, a stick mix dissolved in water, or a scoop from a canister. The engine treats all three formats as the same unit for purposes of `aforceUnitsToday` and the absorption-cap math. **(§2.1, §2.4, §4.7)**

**AFORCE_SODIUM_PER_UNIT_MG.** Constant exported from `services/sweatRateEngine.ts:128`, value `25`. Each AForce serving contributes 25 mg of sodium. The intentionally small number is the foundation of the "recovery is not driven by sodium alone" positioning surfaced on the Recovery Intelligence card. **(§4.7)**

**AICommand.** Output object produced by `generateCommand()` (`utils/scoringEngine.ts:537`). Contains `action` (short imperative), `explanation` (rationale), `urgencyLevel` (`low | medium | high | critical`), and `estimatedImpact` (predicted score delta). **(§3.5)**

**AppState.** Top-level shape held by `useAppStore` and mutated only via the pure `reducer` in `store/appStoreReducer.ts`. Includes `userState`, `engineOutput`, `timerSeconds`, `pendingConfirmation`, `sweatAutopilot`, `sweatAutopilotSetAt`, `history`, and the boolean UI flags. **(§1.2)**

**Apple Health / HealthKit.** iOS biometric system. The bridge in `services/appleHealth.ts` reads `restingHeartRate`, `hrvSdnn`, and `sleepHoursLastNight`. The values flow into `UserState.appleHealth` and contribute to the score via the HealthKit branch in `buildBreakdown()`. **(§1.4, §2.1)**

**Autopilot.** A physiologically-paced recheck cadence triggered by completing a Sweat Calculator session. Replaces the band-default recheck timer for a fixed 4-hour window with an interval derived from the user's just-measured hydration deficit. **(§4)**

**Autoscan / HydroScan.** The product-recognition pipeline (`screens/HydrationScanScreen.tsx`, `services/hydrationScanService.ts`). User points the phone at a barcode; the app identifies the product, scores it against the live user state, and conditionally suggests an AForce replacement. **(§5)**

## B

**BAC.** Blood alcohol concentration. Estimated by `services/bacEstimationService.ts:92` using the Widmark approximation, parameterized by sex, weight, drinks, ABV, time elapsed, and food intake. Drives the Social Mode override in the Deterministic AI Layer. **(§3.3)**

**Band (performance band).** One of `PEAK / BALANCED / RECOVERING / DEPLETED`, determined by `resolveState()` (`utils/scoringEngine.ts:38`) at the thresholds 90 / 75 / 60. Each band has a default recheck interval and a default pulse animation. **(§2.6)**

**BaseDecay.** Per-minute score-decay rate computed by `computeDecayPerMinute()` (`utils/scoringEngine.ts:166`). Function of body weight, activity level, ambient temperature, humidity, sleep / clutch state, and any active alcohol multiplier. **(§2.5)**

**Breakdown.** Array of `ScoreContribution` objects (`{id, label, delta, maxMagnitude, hint}`) returned alongside every `score`. Powers the "Why this score?" sheet (`components/ScoreBreakdownSheet.tsx`) — every score shipped to the UI is auditable. **(§2.2, §3.1)**

## C

**Cadence ladder (Autopilot).** The 8 / 12 / 20 minute interval table returned by `deriveAutopilot(deficitPct)` (`services/sweatRateEngine.ts:489`). **(§4.3)**

**Catalog (product).** Local beverage database in `data/productDatabase.ts` indexed by barcode and product ID. Supplemented at runtime by Open Food Facts for unknown barcodes. **(§5.3)**

**Clerk.** Third-party auth provider integrated via `ClerkProvider` (root layout) and `components/ClerkAuthBridge.tsx`. The `(tabs)` layout redirects unauthenticated users to `/(auth)/sign-in`. **(§1.4)**

**Clutch Strategy.** Performance overlay in `utils/scoringEngine.ts:790`. When `clutchActive` is true (user marked a high-intensity competitive window), decay is multiplied by 1.3, AForce-led commands are preferred, and the recheck cadence is shortened. **(§3.4)**

**Command (AICommand).** See *AICommand*.

**Compliance streak.** `userState.complianceStreak` — number of consecutive days the user has hit their oz target. Adds up to +15 to the score via the `consistency` term. **(§2.3)**

## D

**Decay.** The per-minute score reduction applied between intakes. See *BaseDecay*. The integrated total over `[lastIntakeTime, now]` is computed by `computeDecayPoints()` (`utils/scoringEngine.ts:215`). **(§2.5)**

**Deficit % (deficitPct).** Hydration deficit expressed as a percentage of body mass, computed by the sweat-rate engine. The single input that drives the Autopilot ladder. **(§4.3)**

**DEPLETED.** Lowest performance band, `score < 60`. Triggers the `cmd-depleted` command and a 5-minute recheck interval by default. **(§2.6)**

**Deterministic AI Layer.** The complete rule pipeline that takes a `UserState` snapshot and returns an `AICommand`. Pure-function, no remote inference, identical input ⇒ identical output. **(§3)**

## E

**EngineSlice.** Memoized React context (`store/slices.tsx`) projecting `engineOutput` so consumers re-render only when the score / command actually changes. **(§1.2)**

**expo-camera.** Native camera library used for barcode scanning in `components/CameraScanModal.tsx`. Reads `ean13`, `upc_a`, `qr`, and `code128` symbologies. **(§5.2)**

**expo-router.** File-based navigation library used by `app/`. Routes derive from filesystem paths (e.g. `app/(tabs)/index.tsx` → `/`). **(§1.1)**

## F

**Fit score.** 0–100 score produced by `services/comparisonEngine.ts` for any beverage against a given user state. Used by Autoscan to decide whether to recommend an AForce replacement. **(§5.4, §5.5)**

## G

**Guardian Risk Engine.** Composite risk score computed by `guardianRiskScore()` (`utils/scoringEngine.ts:728`) from hydration %, body weight, active minutes, heat index, sweat rate, core temp estimate, quarter, and pH. Tiered into `OPTIMAL / WATCH / MODERATE / CRITICAL` by `guardianTier()`. **(§3.4)**

## H

**Heat Guard.** Hook (`hooks/useHeatGuard.ts`) that combines climate input + symptom load + Apple Health into a heat-stress score and a recheck cadence. The primary consumer of Autopilot — when an autopilot window is active, Heat Guard returns the autopilot interval instead of its own band default. **(§4.5)**

**HRV (hrvSdnn).** Heart-rate variability, SDNN method, in milliseconds. Read from Apple Health and used as a recovery-quality signal in the score formula. **(§2.1, §3.2 step 2)**

**HydroScan.** See *Autoscan*.

## I

**Impairment level.** One of `LOW / ELEVATED / MODERATE / HIGH / CRITICAL`, mapped from BAC by `services/legalSafetyService.ts:28`. Determines which Social Mode command the engine emits. **(§3.3)**

**IntakeEvent.** Single logged consumption event (`{loggedAt, oz, fluidType, flavor, ...impact}`). The list `userState.intakeEvents` drives the per-event absorption math. **(§2.1)**

**Inventory.** `userState.inventory` — `{sticks, rtd, canister}` integer counts. Used by the Sweat Calculator's Recovery Protocol resolver (RTD > sticks > canister, restock fallback). **(§1.2)**

## O

**Open Food Facts.** Free public beverage / food database. Used by `services/productRecognitionService.ts:126` as a fallback when a barcode is not in the local catalog, so any US beverage can resolve to a `ScannedProduct`. **(§5.3)**

## P

**PEAK.** Top performance band, `score ≥ 90`. Triggers the `cmd-peak` command and a 20-minute recheck interval by default. **(§2.6)**

**pulseConfig.** Animation configuration for the `StatusPulseOrb` component. Fields include `waveBehavior` and `animations`. Computed in the engine and passed verbatim to the orb. **(§2.7)**

**Pure function.** A function whose output is determined solely by its inputs and which has no observable side effects. Both the score engine and the reducer are pure; this is the foundation of the determinism claim. **(§3.1)**

## R

**RECOVERING.** Mid-low performance band, `60 ≤ score < 75`. Triggers the `cmd-recovering` command and a 10-minute recheck interval by default. **(§2.6)**

**Recheck interval.** Time, in minutes, until the timer expires and the user is prompted to log again. Determined by band default *unless* an Autopilot window is active. **(§2.6, §4.3)**

**Recovery window.** The 4-hour period after a sweat session during which Autopilot drives the recheck cadence. Length follows the Sawka 2007 post-exercise rehydration window. **(§4.6)**

**RTD.** Ready-to-drink — a pre-mixed AForce bottle (11 oz / 325 ml). One of three product formats; preferred by the Sweat Calculator's protocol resolver when in stock. **(§1.2, §4.7)**

## S

**Sawka 2007.** Reference to *Sawka et al., "Exercise and Fluid Replacement," ACSM Position Stand, 2007*. Source for the sweat formula `(pre − post + fluid − urine) / duration` and the 4-hour post-exercise rehydration window. **(§4.6)**

**ScoreEngineOutput.** Top-level engine return shape. See §2.2 of the brief for the full type. **(§2.2)**

**ScoreContribution.** Single line in the breakdown — `{id, label, delta, maxMagnitude, hint}`. Bounded by `maxMagnitude` so any one term cannot dominate. **(§2.2)**

**SET_SWEAT_AUTOPILOT.** Reducer action dispatched by `commitSession()` after a Sweat Calculator run. Stores `sweatAutopilot` + `sweatAutopilotSetAt`, resets `timerSeconds = intervalMin × 60`, and clears `pendingConfirmation`. **(§4.4)**

**Slice.** Memoized React context that projects part of `AppState`. Slices: `EngineSlice`, `UserSlice`, `SocialSlice`, `CycleSlice`, `InventorySlice`, `SweatAutopilotSlice`. **(§1.2)**

**Social Mode.** The alcohol-mitigation path. When `userState.socialMode.active` is true, the Deterministic AI Layer swaps in a parallel ruleset (BAC, impairment, transportation safety) that takes precedence over the standard performance ladder. **(§3.3)**

**Sodium gap (sodiumGapMg).** `max(0, sodiumLossMg − aforceSodiumTotalMg)` — the intentional shortfall surfaced as "covered by structured-water absorption + marine minerals" on the Recovery Intelligence card. **(§4.7)**

**Sweat Calculator (Sweat Intelligence v2).** Screen at `/sweat` (`screens/SweatCalculatorScreen.tsx`). Three input modes — Quick / Precision / Estimate — feed `services/sweatRateEngine.ts`, which produces sweat rate, deficit %, sodium loss, AForce sodium delivered, sodium gap, and the Autopilot derivation. **(§1.1, §4.2)**

**SweatAutopilot.** Type returned by `deriveAutopilot()`. Shape: `{intervalMin, urgency, recoveryWindowHours}`. **(§4.3)**

## U

**Urine signal.** `userState.urineSignal` on a 1–8 scale. 1 = clear; 8 = dark amber. Concentration penalty engages at ≥ 5; clear-urine bonus engages at ≤ 2. Sourced from the user's color-card self-report in the check tab. **(§2.1)**

**UserState.** Single Postgres-backed user-record snapshot. Inputs to every engine call; mutated only through reducer actions and server writes. **(§2.1)**

## V

**Voice service.** `services/voiceService.ts` orchestrator. Classifies a transcript into an intent (`LOG_INTAKE`, `GET_STATUS`, …), executes it, and renders a brand-aligned spoken response via `voiceTemplateEngine.ts`. **(§1.4)**

## W

**WebSocket subscription.** `services/realApi.ts#subscribeToStateUpdates`. Real-time push channel from `api-server`; lets a second device (e.g. an Apple Watch in the future, or a coach's phone today) reflect a state update within a second of it being persisted. **(§1.3)**

**Widmark approximation.** The standard pharmacokinetic BAC equation, parameterized by sex (r factor), body weight, alcohol mass consumed, and elimination rate. Implemented in `services/bacEstimationService.ts:92`. **(§3.3)**

---

## Common acronym table

| Acronym | Expansion | First section |
|---|---|---|
| ABV | Alcohol By Volume | §3.3 |
| ACSM | American College of Sports Medicine | §4.6 |
| BAC | Blood Alcohol Concentration | §3.3 |
| BSA | Body Surface Area | §1.1 (Sweat Calculator estimate path) |
| HRV | Heart Rate Variability | §2.1 |
| OFF | Open Food Facts | §5.3 |
| RTD | Ready-To-Drink | §1.2 |
| SDNN | Standard Deviation of NN intervals (HRV method) | §2.1 |
| WS | WebSocket | §1.3 |
