# CR-HYDROSTATE-V2-0 — Water only; no social term

**Change record** per `governance/INTELLIGENCE-CHANGE-CONTROL.md` §2 · **Severity:** Critical (touches
the hero metric's score behaviour, §3) · **Version:** `hydrostate-v1.0` → `hydrostate-v2.0` (major)

## 1. Proposed change

- **Id:** CR-HYDROSTATE-V2-0 · **Date:** 2026-11-12 · **Author:** Engineering (Claude Code) for Brandon
- **Summary:** implement founder decisions C1 and C2 from the spec v1.8.2 decision brief:
  - **C1:** only water moves HydroState.
    - Plain water counts 1:1.
    - AFORCE products count as their mixing water.
    - Phantom Band sips count as water.
    - Every other drink is saved to a separate drink log and never changes HydroState, today's ounces or the decay clock until its own expert-reviewed rule is approved.
  - **C2:** social context never changes HydroState. The social drink penalty and the social decay multiplier are removed.

## 2. Affected systems

HydroState™ (score and decay), the drink logging surfaces (HydroScan, Add a drink), and the
api-server `/drinks` route (already written, now mounted). The Social mode engine is unaffected:
it still steers commands and copy.

## 3. Architectural impact

The scoring engine (`utils/scoring/breakdown.ts`) is off-limits under `CLAUDE.md`. Brandon gave
explicit approval on 2026-11-12 to edit it for C2 only. No other scoring file changes. Scoring stays
client-computed; the server still stores client scores as before.

## 4. Privacy impact

Non-water drinks are written to `aforce_recorded_drinks`: user id, category, display name, ounces,
entry source and a client event id. They are owned by the member, never shared with a Circle, and
never become score evidence. Like intake history, the table is **not** covered by today's
health-data deletion endpoint (`routes/accountDeletion.ts`, health scope only). Full account
deletion (decision D4) must include `aforce_recorded_drinks` before public release.

## 5. Compliance impact

This is the conservative direction: the app stops presenting unreviewed coefficients as hydration
credit (CLAIMS-REGISTER C5/C6 posture). New copy:

- "Saved to your log. It moves HydroState once its drink rule is approved."
- "Water moves HydroState today."
- "No change today."
- "Not logged · Your drink was not saved. Try again."

## 6. Scoring impact

Output changes for identical inputs:

- **Coffee, tea, soda, juice, energy, sports, electrolyte, alcohol, smoothie, custom and sparkling water** previously added coefficient-weighted ounces (0.1–1.1×). They now add **0** and do not reset decay.
- **Plain and bottled water** logged through Add a drink previously used their coefficient (1.0). They now count exactly the entered ounces.
- **Social mode drinks** previously subtracted up to 30 points and sped up decay. They now change nothing.
- **Water, AFORCE products and Phantom Band sips** logged on their own surfaces are unchanged.

## 7. Migration impact

None to scored data. Snapshots keep the version they were stamped with and are never re-derived;
`modelBoundary.ts` stops a chart from joining v1.0 and v2.0. Intake events already stored inside the
24-hour window keep their stored impact until they age out. The `/drinks` table needs
`lib/db/migrations/20261111_recorded_drinks.sql` applied on the production database (founder step)
before saves succeed; until then a save shows "Not logged".

## 8. Test impact

- **Updated:**
  - `scoreClockDeterminism.test.ts`: the golden breakdown loses the zero `social_intake` key, and the social test now asserts social drinks never change the score.
  - `factorDeltasVector.test.ts`: the key list drops `social_intake`.
  - `modelVersionBoundary.test.ts` and `hydroStateModelVersionParity.test.ts`: v2.0, not comparable to v0 or v1.0.
- **New:** `drinkRoute.test.ts` (which drinks count; every saved category is accepted by the server contract).
- **Runs:** app, api-server lib and route suites pass, except `rawColorMigrationR5`, which already fails on `main`.

## 9. Rollback plan

Revert the PR. Scores return to v1.0 behaviour for new events. Saved drink-log rows stay in their
own table and are harmless to v1.0. No user data is rewritten either way.

## 10. Required approvals (§4)

| Role | Who | Status |
|---|---|---|
| Founder | Brandon | Approved 2026-11-12 (decision brief, C1 + C2, including the off-limits scoring edit for C2) |
| Engineering | Claude Code (this PR), human reviewer on merge | This PR |
| Scientific (C1 changes drink credit) | Julius | **Required before merge**, recorded in `PROOF-TRACKER.md` §7.1 |

## 11. Reconciliation

`PROOF-TRACKER.md` §7 C1 and C2 move to resolved when this merges.

These docs still describe the old behaviour and are superseded by v2.0 for scoring:

- `INTELLIGENCE-EVENT-REGISTRY.md`: `caffeine_logged`, `alcohol_logged` and `product_consumed` as HydroState inputs.
- `AFORCE_OS_NIGHT_OUT_PROTOCOL_SPEC.md`: the alcohol effect on the score.
- `AFORCE_OS_RECONCILIATION_REGISTER.md` NO-3.

Update them in a follow-up docs PR.

## 12. Version increment

HydroState™ scoring model: `hydrostate-v1.0` → **`hydrostate-v2.0`**, major (output changes for
identical inputs and the scoring contract changes). The app constant and the api-server mirror move
together; the parity test enforces it. The registry rows are in `MODEL-VERSION-REGISTRY.md`.
