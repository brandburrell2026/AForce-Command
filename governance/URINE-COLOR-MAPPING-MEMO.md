# Urine Color → Signal Mapping

**Status: APPROVED FOR BETA / NOT SCIENTIFICALLY VALIDATED**
Founder decision 2026-08-14. Ratified for Phase-1 beta only.

> **⚠️ SUPERSEDED FIRST RATIFICATION.** The original mapping
> (`clear 1 · light_yellow 2 · yellow 4 · dark_yellow 7`) was ratified on an
> **incorrect memo of mine** which claimed urine did not affect HydroState. It
> does. `yellow: 4` silently cost **4 HydroState points**, observed on device as
> an exact −4 drop. That claim came from grepping `scoringEngine.ts` alone; the
> computation lives in `utils/scoring/breakdown.ts`. A single-file grep is not a
> search.
>
> **RE-RATIFIED MAPPING — `clear 1 · light_yellow 2 · yellow 3 · dark_yellow 5`.**
> Approved for beta; **not** scientifically validated. Passing tests are not
> ratification, and this must never be described as validated.
>
> **Founder rationale.** The UI is a coarse 4-category self-report, not a direct
> physiological measurement; no approved AForce science specification defines a
> numeric mapping; clear, light_yellow and yellow must not directly penalise
> HydroState during Phase-1 beta; only `dark_yellow` crosses **either** threshold.
> This reduces the risk of over-interpreting ordinary yellow urine.
>
> **Member-facing constraints.** The numeric value is internal and must never be
> shown to members. No copy may imply the app measured urine concentration or
> hydration physiologically. The shipped disclaimer stands.
>
> **Replaceability.** The mapping stays isolated in `URINE_COLOR_SIGNAL` so it can
> be replaced after science validation as a single-constant edit. Do not change
> these numbers again without founder approval.

## Provenance of the numbers: NEWLY INFERRED

**No approved AForce spec defines a urine color → numeric signal mapping.** A
full search of `governance/` and `docs/` found urine referenced only as **copy**
— `CR-1-SCIENTIFIC-SUBSTANTIATION-PASS.md` reviews the *verdict wording* for the
`yellow` and `dark_yellow` branches and flags a separate signal-quality
overclaim. No document specifies a scale, a threshold, or a numeric value.

Before this change the screen never wrote the signal at all, so **no prior
mapping existed to preserve or contradict**. The four numbers were chosen to
connect a 4-tile UI to the pre-existing 1–8 wire contract
(`types/index.ts`: *"1 (clear/optimal) – 8 (very dark)"*; server validates
`int().min(1).max(8)`), and — as ratified — deliberately keep the three lighter
tiles BELOW the engine's pre-existing "dark" threshold of 5.

That is a defensible reading of a 4-step self-report against an 8-step scale.
**It is not derived from hydration literature and carries no clinical
authority.**

## URINE AFFECTS TWO SYSTEMS — HydroState AND heat risk

This is the correction. `urineSignal` feeds **two independent formulas with
different thresholds**, and the first ratification accounted for only one:

| Consumer | Formula | Penalises |
|---|---|---|
| **HydroState score** — `utils/scoring/breakdown.ts` | `-max(0, s - 3) * 4` | **above 3** |
| **Heat risk** — `services/heatRiskEngine.ts` | `s >= 5 ? (s - 4) * 2 : 0` | **at 5+** |

Because the score's threshold is **3**, not 5, a tile can be "below the heat-risk
threshold" and still cost HydroState points. That is exactly what happened.

**Both formulas are approved and UNCHANGED.** Only the mapping moved.

## The mapping and its downstream effect

| UI color | Signal | HydroState penalty | Heat-risk pts |
|---|---|---|---|
| Clear | 1 | **0** | **0** |
| Light Yellow | 2 | **0** | **0** |
| Yellow | 3 | **0** | **0** |
| Dark Yellow | 5 | **−8** | **2** |
| *(DB default, no check yet)* | *3* | *0* | *0* |

**Only `dark_yellow` crosses either threshold.** `yellow: 3` sits exactly at the
HydroState boundary (`max(0, 3-3) = 0`), which is the intended conservative
posture.

Formula, unchanged and untouched — `services/heatRiskEngine.ts`:

```ts
const urinePts = input.urineSignal >= 5 ? (input.urineSignal - 4) * 2 : 0;
```

`urinePts` is added to symptom points inside the **`symptom_risk`** factor, which
is clamped to **0–18**. Under the ratified mapping only `dark_yellow`
contributes, at **6** of a possible 18 in that one factor.

## What is and is not affected

- **HydroState score: DIRECTLY AFFECTED** via `utils/scoring/breakdown.ts`
  (threshold 3). *The earlier claim that it was unaffected was wrong.*
- **Heat risk: affected** via `heatRiskEngine` (threshold 5).
- **Recovery snapshot: affected.** `urineSignal` is an input to
  `deriveRecoverySnapshot` (gated behind `spec_recovery`).
- **Protocol: NOT sensitive to the value.** `protocolDerivation.ts` tests
  `urineSignal > 0`, which is true for all four tiles equally.

## Decision taken

The question was **where the "dark" threshold falls relative to the four tiles**,
since the engine's threshold (5) is fixed and pre-existing. The founder chose the
conservative option: only `dark_yellow` registers.

Changing this is a **single-constant edit** to `URINE_COLOR_SIGNAL` in
`services/urineHydrationCheck.ts`. Nothing else in the write path, the tests, or
the persisted contract moves. A beta-safe fallback — mapping all four tiles below
the threshold so the check persists and displays but contributes zero risk — is
also a one-line change to that same constant.

## What the tests do and do not prove

`services/__tests__/urineMappingPenalties.test.ts` now pins the mapping against
**both** consumers — a HydroState penalty table and a heat-risk penalty table —
and fails if any future mapping lets clear, light_yellow or yellow cross either
threshold. It also pins both formulas to their source, so an upstream edit forces
re-ratification rather than silently invalidating the tables.
Mutation-verified: restoring `yellow: 4` fails 3 assertions; `yellow: 5` fails 7.

The suite proves the mapping is **internally consistent with the approved
formulas** and durable across reload. **It proves nothing about clinical or
product appropriateness.** Passing tests are not ratification — the first
ratification passed its tests and was still wrong.

---

# Appendix — 409 conflict copy (APPROVED AND IMPLEMENTED)

`POST /aforce/intake` now returns **409** when the user-state row the write
depends on is absent. The client's classifier
(`store/app/writeFailure.ts`) maps every 4xx that is not 401/403/408/429 to
`invalid`, so a 409 currently reads:

> **Not saved — entry rejected**
> The server wouldn't accept this entry, so nothing was recorded. Try again, and
> update AForce if it keeps happening.

That is misleading for a conflict: the entry was fine, and updating the app will
not help. A retry usually will, because the route pre-seeds state.

**Recommended copy:**

> **Not saved — try that again**
> We couldn't line that up with your current day, so nothing was recorded. Try
> again — it usually works straight away.

(Shipped wording says "Try again" rather than "Try once more": the copy lock
requires every body to carry an actionable instruction from a fixed vocabulary.)

**Scope if approved:** add a `conflict` kind to `WriteFailureKind`, map 409 to
it, add one title/body pair to `WRITE_FAILURE_COPY` and to each locale file.
Copy-only — no logic, no scoring, no server change. The existing byte-for-byte
locale lock test would extend to cover it.

**APPROVED AND IMPLEMENTED** (founder, 2026-08-14). A `conflict` kind was added
to `WriteFailureKind`, 409 maps to it, and the title/body pair was added to
`WRITE_FAILURE_COPY` and every locale. Copy-only — no logic, no scoring, no
server change. The byte-for-byte locale lock now covers it.
