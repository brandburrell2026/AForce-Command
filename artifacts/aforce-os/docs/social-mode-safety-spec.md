# Social Mode — Safety & Estimation Spec

This document is the canonical reference for the BAC estimator,
impairment escalation, transportation prompts, and recovery flow that
power **AForce OS Social Mode**. Anyone touching the engine, UI, or
copy must read this first.

---

## 1. Voice & tone

Social Mode is **calm, protective, never preachy**.

- The system **never** moralizes, lectures, or shames the user for
  drinking. It does not use words like "stop drinking", "you should
  not", or "irresponsible".
- The system **never** says the user is "safe to drive" or implies
  legal compliance. The strongest positive language allowed is "your
  estimate is currently low" — it never crosses into permission.
- When escalating, the system uses protective verbs: *plan a ride,
  switch to water, arrange safe transport, stop alcohol intake*. It
  describes outcomes, not character.
- Headlines are short. Bodies are 1–2 sentences max.

---

## 2. BAC estimation (Widmark approximation)

Implemented in `services/bacEstimationService.ts`.

```
gramsAlcohol = sum( drink.oz * (drink.abv/100) * 0.789 * 29.5735 )
bodyMassG    = bodyWeightLbs * 453.592
r            = 0.68  (male / unspecified)  |  0.55  (female)
foodFactor   = 0.92  if ateRecently else 1
bacRaw       = (gramsAlcohol / (bodyMassG * r)) * 100 * foodFactor
elapsedH     = hours since first drink
bacCurrent   = max(0, bacRaw - 0.015 * elapsedH)
```

The output is a **range** widened by ±0.01 around the point estimate.
We never display a single false-precision number.

| Field                   | How it's derived                                                                 |
| ----------------------- | -------------------------------------------------------------------------------- |
| `rangeLow` / `rangeHigh`| Point estimate ± 0.01.                                                           |
| `trend`                 | Compare current BAC to BAC 15 min ago; \|Δ\| < 0.005 = `steady`.                 |
| `confidence`            | `high` if sex is provided AND ≥50% of drinks have explicit oz/abv AND ≤8 drinks. |
| `timeToClearMinutes`    | `(bacCurrent − 0.005) / 0.015 * 60`, rounded **up** to nearest 5 min.            |

### Inputs

- `drinks`: `{ type, loggedAt, abv?, oz? }[]` — `abv`/`oz` fall back to
  the catalog defaults when omitted.
- `bodyWeightLbs`: floored to 80 lbs to avoid divide-by-tiny errors.
- `sex`: optional. `'male' | 'female' | 'unspecified'`.
- `ateRecently`: optional boolean.

### Drink catalog (`data/alcoholDrinks.ts`)

| Type           | Default oz | Default ABV | Decay multiplier | Sugar load |
| -------------- | ---------- | ----------- | ---------------- | ---------- |
| `beer`         | 12         | 5.0         | 1.15             | 3          |
| `wine`         | 5          | 12.5        | 1.20             | 4          |
| `cocktail`     | 8          | 14.0        | 1.30             | 8          |
| `liquor`       | 1.5        | 40.0        | 1.35             | 1          |
| `hard_seltzer` | 12         | 5.0         | 1.15             | 1          |
| `custom`       | 6          | 12.0        | 1.25             | 4          |

---

## 3. Impairment escalation matrix

Implemented in `services/legalSafetyService.ts`. Mapping uses the
**midpoint** of the BAC range so trend is smooth across refreshes.

| BAC midpoint   | Level       | Safety card | Stop drinking? | Coach command                        |
| -------------- | ----------- | ----------- | -------------- | ------------------------------------ |
| < 0.030        | `LOW`       | hidden      | no             | (standard hydration / pacing copy)   |
| 0.030 – 0.049  | `ELEVATED`  | hidden      | no             | (standard hydration / pacing copy)   |
| 0.050 – 0.079  | `MODERATE`  | shown — caution  | no        | "Plan a ride before your next drink" |
| 0.080 – 0.119  | `HIGH`      | shown — warning  | **yes**   | "Do not drive. Use a rideshare."     |
| ≥ 0.120        | `CRITICAL`  | shown — critical | **yes**   | "Stop alcohol intake. Recovery req." |

The safety card is hidden at `LOW` and `ELEVATED` so the user only sees
the legal-protection language when it actually applies. The "stop
drinking" sub-prompt only appears at HIGH/CRITICAL.

---

## 4. Disclaimer policy

Every surface that shows a BAC value, impairment level, transportation
prompt, or recovery time **must** render the standard disclaimer pair:

> **Estimate only · Not a legal or medical determination.**

The i18n keys are `social.estimate_only` and `social.not_legal_medical`.
They are translated in all 6 supported locales (`en`, `es`, `fr`, `de`,
`pt`, `it`).

The system **never**:

- Tells the user they are "safe to drive".
- Promises a specific BAC at a specific future time.
- Asserts compliance with any legal limit (those vary by jurisdiction
  and by individual physiology).
- Provides medical advice (kidney/liver concerns, medication
  interactions, etc.).

---

## 5. Recovery Mode

Triggered when the user taps **End Night** in the Social Mode sheet.
Engine sets `socialMode.endedAt` and the rollup flips
`inRecoveryWindow = true` for the next 8 hours
(`RECOVERY_WINDOW_MS = 8 * 60 * 60 * 1000` in `socialModeEngine.ts`).

While in recovery the UI renders `RecoveryModeCard` showing:

1. The estimated time until BAC clears (from `bac.timeToClearMinutes`).
2. A 3-step morning protocol — water → AForce RTD → 7+ hours sleep.
3. The standard disclaimer pair.

The home banner shifts to amber and reads `social.recovery_active`.

---

## 6. Orb overlay

`StatusPulseOrb` accepts `socialOverlay?: { alcoholLoad: number; unstable: boolean }`.

- `alcoholLoad` ∈ [0, 1] is derived from the active decay multiplier
  and pushes a subtle violet outer ring.
- `unstable = true` when impairment is HIGH or CRITICAL — the ring
  flips crimson and pulses faster.

The overlay is purely additive; it never replaces the normal hydration
gradient.

---

## 7. Test invariants

`services/__tests__/bacEstimation.test.ts` pins:

- Zero drinks → zero BAC, zero clear time.
- One beer → LOW band.
- Four quick liquor shots → at least MODERATE.
- Trend: rising right after drinks, falling after long elimination.
- Time-to-clear is non-negative and a multiple of 5 minutes.
- Confidence degrades when sex is unspecified.
- Food intake softens the BAC estimate vs an empty stomach.
- Safety prompt is hidden at LOW/ELEVATED.
- Safety prompt escalates to "do not drive" at HIGH and CRITICAL.
- Safety disclaimer key is always returned.

These invariants must continue to hold after any change to the engine
or the impairment thresholds.
