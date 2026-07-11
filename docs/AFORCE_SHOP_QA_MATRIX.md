# AFORCE Shop — QA Gates (§13)

Generated for `aforce-site/shop/index.html`. Re-run live with
`window.aforceEnumerate()` in the console (or load `/shop/?debug`).

## QA-1 — Variant matrix (rule: every combination is *purchasable* OR *unselectable* — no third state)

Model: `{format}_{protocol}_{flavor}_{commitment}` — Performance one-time
(sticks 1/3 month · RTD one-time) is purchasable now; every subscription path
(AutoPilot protocol · Ongoing commitment) is **gated UNSELECTABLE** in the UI
until `RITUAL_MEMBERSHIP_PLAN` is set, so no selectable path is ever unpurchasable.

| # | Combination (selectable in UI) | Variant | Price (COPY) | Selling plan | Result |
|---|--------------------------------|---------|--------------|--------------|--------|
| 1 | sticks · performance · watermelon · 1 Month | 43817245868150 | $59.99 | none | **PASS — purchasable** |
| 2 | sticks · performance · watermelon · 3 Months | 43817536487542 | $179.97 | none | **PASS — purchasable** |
| 3 | sticks · performance · berry · 1 Month | 43817131606134 | $59.99 | none | **PASS — purchasable** |
| 4 | sticks · performance · berry · 3 Months | 43817536422006 | $179.97 | none | **PASS — purchasable** |
| 5 | sticks · performance · soursop · 1 Month | 43817131638902 | $59.99 | none | **PASS — purchasable** |
| 6 | sticks · performance · soursop · 3 Months | 43817536454774 | $179.97 | none | **PASS — purchasable** |
| 7 | rtd · performance · watermelon · One-Time | 43817994198198 | $29.99 | none | **PASS — purchasable** |
| 8 | rtd · performance · berry · One-Time | 43817994190966 | $29.99 | none | **PASS — purchasable** |
| 9 | rtd · performance · soursop · One-Time | 43817994223734 | $29.99 | none | **PASS — purchasable** |

**Gated UNSELECTABLE (until `RITUAL_MEMBERSHIP_PLAN` is set — then auto-enable):**
`{sticks,rtd}_performance_{flavor}_ongoing` (×6) and `{sticks,rtd}_autopilot_{flavor}` (×6)
— AutoPilot card + Ongoing commitment option render disabled ("OPENING SOON").

**Verdict:** 9 selectable → 9 purchasable · 12 subscription paths unselectable → **no selectable-but-unpurchasable state. QA-1 PASS.**

_Pending to make the 12 subscription paths purchasable: the numeric Ritual
Membership `SellingPlan` id (recurring) and, for §8 "Three Months = prepaid",
a prepaid plan id. Both are admin-side._

## QA-2 — Analytics events

`track()` pushes to `window.dataLayer` (+ optional `window.aforceTrack` hook).
Wire GA4 / the Shopify pixel to `dataLayer`.

| # | Event | Fires on | Key params |
|---|-------|----------|------------|
| 1 | `intent_selected` | intent chip tap | `intent` |
| 2 | `protocol_selected` | protocol card | `protocol` |
| 3 | `format_switched` | format card | `format` |
| 4 | `commitment_selected` | commitment option | `commitment` |
| 5 | `formulation_selected` | flavor card | `formulation` |
| 6 | `begin_ritual_clicked` | BEGIN button | `key`, `ready` |
| 7 | `checkout_started` | valid BEGIN → redirect | full state + `key`, `subscription` |
| 8 | `purchase_completed` | **Shopify order-status page (§12)** | variant + selling plan |

Events 1–7 fire in the builder. **`purchase_completed` fires on the Shopify
thank-you/order page** (§12, Shopify-admin side) — it can't fire on the static
builder because the purchase completes after the cart-permalink redirect.

_Verification (§13 deliverable 3): one test purchase should show 1–7 land in
order in `dataLayer`, then `purchase_completed` on the order page — pending a
live checkout (needs the plan id + pixel installed)._
