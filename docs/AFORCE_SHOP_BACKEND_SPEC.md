# AFORCE Shop — Backend Implementation Spec (Sections E–H)

**Status:** Handoff spec for the AForce OS app + Node/Replit backend team.
**Scope:** Everything the static marketing site (`aforce-site/shop/`) **cannot** build — real checkout, the payment webhook, Performance Profile (PP) generation, the confirmation page/email, and app first-open.
**Companion:** The frontend flow (Sections 0, A–D) is built in [`aforce-site/shop/index.html`](../aforce-site/shop/index.html), copy-driven by [`aforce-site/shop/shop-config.js`](../aforce-site/shop/shop-config.js).

> **Why this is a separate doc:** Sections E–H require Stripe secret keys, writes to the production AForce OS user record, an email service, and app code. Per repo rules those touch **secrets and deployment** and are founder-owned. Build them in the app/backend repo, not the static site.

---

## 0. Handoff payload from the website

When the customer clicks the Section D purchase button, the frontend fires `checkout_started` and calls `window.AForceCheckout(payload)` **if that bridge is defined**. Define it to start Stripe Checkout. Payload shape:

```json
{ "protocol": "trial | performance | autopilot",
  "flavor":   "red | blue | green",
  "months":   1 }
```

The frontend also holds `intent` (Section 0). Expose it or read it from `window.AFORCE_SHOP_CONFIG` state — the backend must persist `intent` too (see §F user record). Recommended: extend the bridge contract to `{ protocol, flavor, months, intent }` when wiring checkout.

Map ids → SKUs/prices from `shop-config.js` on the **server** (never trust client prices). Server is the source of truth for amount charged.

---

## SECTION E — CHECKOUT PAGE

Top of checkout (CMS-configurable copy):

```
PERFORMANCE PROFILE
Not yet initialized.
Upon purchase, your profile will be created automatically.

Included:
✓ AFORCE OS
✓ Daily Standard
✓ Performance Profile
✓ Personalized Hydration Intelligence
```

**Locked language:** Use **"Personalized Hydration Intelligence"** verbatim. Never substitute "your hydration level," "detects dehydration," "measures your hydration," or any phrasing implying clinical measurement. This is a compliance lock.

**Tone:** No sales language, no hype, no urgency. Confidence only. No discount field unless the founder explicitly enables one (premium rules, §J).

**Analytics:** `checkout_page_viewed` on load. `checkout_completed` on Stripe success (with `protocol, flavor, months, revenue`). `checkout_abandoned` with `last_step` if the session is dropped (fire from client-side beacon or reconstruct from Stripe `checkout.session.expired`).

---

## SECTION F — PURCHASE CONFIRMATION + WEBHOOK (build FIRST; gates §H)

### F.1 Stripe webhook
On `checkout.session.completed` (payment confirmed), the webhook **must**, atomically:

1. **Generate the PP number** — unique, generated at the moment of payment confirmation. Suggested format `PP-` + zero-padded monotonic sequence or a collision-checked random (e.g. `PP-041782`). Must be unique across all users; enforce with a DB unique constraint and retry on collision.
2. **Write to the AForce OS user record:**

   | Field | Source |
   |---|---|
   | `pp_number` | generated in step 1 |
   | `protocol_tier` | `trial \| performance \| autopilot` |
   | `flavor` | `red \| blue \| green` |
   | `intent` | from Section 0 handoff payload |
   | `estimated_delivery_date` | computed from fulfillment SLA |

3. Mark the profile **initialized** only after the write commits.

Idempotency: key on Stripe `event.id` / `session.id` so retried webhooks don't double-create PP numbers.

### F.2 Confirmation page states
- **Step 1 (immediate, always):** `Performance Profile Initializing…`
- **Step 2 (after backend confirms PP write):**
  ```
  Performance Profile
  PP-[unique number]
  Initialized.

  Your ritual begins before your package arrives.

  [ Download AFORCE OS ]
  ```
- **Fallback (no confirmation within 5s):**
  `Your Performance Profile is being created. Check your email for your Profile number.`
  **Never show an error state on this page.** Poll or subscribe; degrade to the fallback, not an error.

**Never** show "Thank you for your order."

**Analytics:** `confirmation_page_viewed`; `pp_number_displayed` (this event *is* the signal the webhook worked); `download_os_clicked`.

---

## SECTION G — CONFIRMATION EMAIL

**Subject (A/B, lean B):**
- A: `Your Performance Profile Is Ready`
- B: `Performance Profile PP-[number] Is Initialized`  ← the personalized PP number is the "this is mine" moment.

**Body:**
```
Performance Profile PP-[number] has been created.

Your [protocol name] ships [estimated date].

Your ritual begins before your package arrives.

[ Download AFORCE OS ]   [ Begin Setup ]
```

**Forbidden:** order-number language, "items in your cart," "you may also like," product upsells, discount codes, referral asks at this stage.

**CMS:** subject + body must be config-editable for A/B testing without code changes.

**Analytics:** `email_opened`, `download_os_clicked_from_email`, `begin_setup_clicked`.

---

## SECTION H — APP FIRST OPEN (post-purchase)  — **do not build until §F webhook is confirmed working**

When a purchaser opens AForce OS for the first time, recognize them before they act:

```
Welcome to your Performance Profile.
PP-[their number]

Your [flavor] [protocol] arrives [estimated date].

Until then — let's learn your baseline.

[ Begin Baseline ]
```

**Fallback:** if PP data is missing from the user record, fall back to the standard onboarding flow. **Never render an empty/broken PP number field.**

**Analytics:** `app_first_open_post_purchase`, `begin_baseline_clicked`.

---

## SECTION L — ANALYTICS MASTER LIST (fire location)

Frontend events already implemented in `aforce-site/shop/index.html` via `track()` → `window.dataLayer` + optional `window.aforceTrack(event, props)`:

| Event | Where | Status |
|---|---|---|
| `intent_selected` (intent) | website | ✅ built |
| `protocol_card_viewed` (protocol) | website | ✅ built |
| `protocol_card_selected` (protocol) | website | ✅ built |
| `why_protocol_overlay_opened` (protocol) | website | ✅ built |
| `commitment_months_selected` (months) | website | ✅ built |
| `flavor_selected` (flavor) | website | ✅ built |
| `checkout_started` (protocol, flavor, months) | website | ✅ built |
| `checkout_page_viewed` | checkout (E) | ⬜ backend |
| `checkout_completed` (protocol, flavor, months, revenue) | checkout (E) | ⬜ backend |
| `checkout_abandoned` (last_step) | checkout (E) | ⬜ backend |
| `confirmation_page_viewed` | confirmation (F) | ⬜ backend |
| `pp_number_displayed` | confirmation (F) | ⬜ backend |
| `download_os_clicked` | confirmation (F) | ⬜ backend |
| `email_opened` | email (G) | ⬜ backend |
| `download_os_clicked_from_email` | email (G) | ⬜ backend |
| `begin_setup_clicked` | email (G) | ⬜ backend |
| `app_first_open_post_purchase` | app (H) | ⬜ app |
| `begin_baseline_clicked` | app (H) | ⬜ app |

**Wire a provider:** define `window.aforceTrack(event, props)` (Segment/GA4/PostHog) — the website needs no change. `dataLayer` is already GA4/GTM-ready.

---

## SECTION K — CONTINUITY THREAD (audit every touchpoint)

One vocabulary, end to end. Values are CMS-configurable; the thread structure is locked.

| Touchpoint | Language | Owner |
|---|---|---|
| Website | Begin the Ritual / Choose Your Performance Protocol | ✅ site |
| Checkout | Performance Profile not yet initialized | backend E |
| Confirmation | Performance Profile PP-[number] initialized | backend F |
| Email subject | Performance Profile PP-[number] Is Initialized | backend G |
| App first open | Welcome to your Performance Profile PP-[number] | app H |
| Product arrival | Your next ritual has arrived | app/ops |
| First ritual complete | First ritual complete | app |
| Subscription renewal | Your next ritual ships in [X] days | backend |
| Day 7 | Your standard is becoming your identity | app/CRM |
| Day 21 | Your body taught us something today | app/CRM |

---

## SECTION J — PREMIUM RULES (apply to E–H; enforced on the site already)

No discount banners · no countdown timers · no spin-to-win / gamification in purchase · no coupon popups · no "people are viewing this" · no "Sarah from Miami just purchased" · no urgency of any kind · no "limited time" · no price-comparison between tiers · no upsells in the confirmation email. Social proof lives in community/editorial only — never in the purchase flow. **Confidence, not urgency.**

---

## SECTION I — DELIGHT MOMENTS (rename generic → AFORCE, CMS-configurable)

`Order Complete → Performance Profile Initialized` · `Subscription Active → AutoPilot Activated` · `Package Delivered → Your Next Ritual Has Arrived` · `Share → Share Your Standard` · `Learn More → Why This Protocol?` · `Cancel Subscription → Pause Your Protocol` · `Sign Up → Begin Your Profile` · `Log In → Return to Your Standard` · `Quantity → How many months should we prepare?` · `Add to Cart → Begin the Ritual`

(The website already applies the ones in its scope: no "Add to Cart," no quantity selector, "Why This Protocol?", "Begin the Ritual.")

---

## Build order (per spec rules)

1. **§E** checkout (Stripe) + `checkout_page_viewed/completed/abandoned`.
2. **§F** webhook + PP generation + user-record write + confirmation page states + 5s fallback. **Confirm working & tested.**
3. **§G** email (after F proven).
4. **§H** app first open — **only after F webhook confirmed.**
5. Verify all §L events fire. Audit every touchpoint against §K. Confirm no §J violation.

---

## §M — RITUAL BUILDER FRONTEND ↔ SHOPIFY HANDOFF (built; IDs pending)

> Updated on branch `feat/shop-checkout-wiring`. Sticks stay monthly;
> **RTD is now a weekly product** with its own two-decision flow.

The shop ritual builder (`aforce-site/shop/index.html`) has **two divergent flows**:
- **Sticks** (monthly): Intent → Format → Protocol (Performance / AutoPilot) → [Commitment — Performance: 1 / 3 month] → Formulation → Begin. AutoPilot is the monthly membership (ongoing) and hides the commitment step.
- **RTD** (weekly): Intent → Format → Formulation → **Order** → Begin. Order = **Try It** (one-time 6-pack, $29.99) or **Performance Protocol** (one 6-pack every week, $29.99/wk — default + recommended). No Protocol / 1-month / 3-month / AutoPilot on the RTD path.

Everything below is the **founder/Shopify-admin side**.

### 1. Checkout = cart-permalink redirect (option b — implemented)
The page is static on Vercel, so `/cart/add.js` cannot run. `beginRitual()`
redirects to a Shopify cart permalink on **`aforce-v2.myshopify.com`**:
- one-time: `https://aforce-v2.myshopify.com/cart/{variantId}:1`
- subscription (sticks AutoPilot · RTD weekly): `…/cart/{variantId}:1?selling_plan={sellingPlanId}` (appended once)

`permalink()` returns `null` — routing to the provisioning fallback — if the
`variantId` is missing, **or** a subscription has no `sellingPlanId`. No cart URL
is ever built with a null id (verified: 15/15 combos → fallback while empty).

### 2. Fill the VARIANT MAP — FILL FROM CSV (15 variants)

| Product | Keys | Needs |
|---------|------|-------|
| Performance Protocol — Sticks | `sticks_performance_{flavor}_{1month\|3month}` | variantId ×6 |
| AutoPilot — Sticks (monthly membership) | `sticks_autopilot_{flavor}_ongoing` | variantId + sellingPlanId ×3 |
| RTD — Try It (one-time 6-pack, $29.99) | `rtd_tryit_{flavor}` | variantId ×3 |
| RTD — Performance Protocol (6-pack / week, $29.99) | `rtd_weekly_{flavor}` | variantId + sellingPlanId ×3 |

`flavor`: `watermelon`(red) | `berry`(blue) | `soursop`(green). The 6 subscription
keys (`sticks_autopilot_*_ongoing`, `rtd_weekly_*`) need both a `variantId` and a
`sellingPlanId`. Run `window.aforceEnumerate()` (or load `/shop/?debug`) to print
all 15 combos and the URL each resolves to.

### 3. Selling plans
Install the **Shopify Subscriptions app** and create the plans, then paste the id
into each subscription entry's `sellingPlanId`:
- **Sticks AutoPilot** → a **monthly** selling plan.
- **RTD Performance Protocol** → a **weekly** selling plan (one 6-pack per week).

Positioning is **"Performance Protocol / Ritual Membership"** — pause, skip, or
cancel anytime. Never "subscription" / "subscribe and save" (guardrail enforced).

### 4. Pricing copy — one constants block
All editable pricing/spec copy lives in the `COPY` object at the top of the page
`<script>`. RTD is set ($29.99 weekly, 6 cans) and Sticks ($59.99 / $179.97) from
the export. **Only placeholders left:** `STICK_COUNT`, `STICK_SERVINGS` (sticks per
month + servings).

### 5. FIX 7 — post-purchase (Shopify admin, not in this repo)
Order-status / thank-you page ("YOUR RITUAL IS PROVISIONED", cohort #, first
delivery date, "DOWNLOAD AFORCE OS") + first email. See §F/§G.

### 6. Pre-launch verification (real phone, cellular)
Permalink lands the right variant + price (and selling plan for subs) · webhook
under load · inventory decrement per variant · full cellular flow.
