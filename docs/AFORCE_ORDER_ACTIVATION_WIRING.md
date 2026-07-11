# §12 — Wiring the Activation Page + Email into Shopify

The activation design lives at `aforce-site/order-confirmed/` (page + email).
Shopify-admin steps to make it fire on a real order. **These are admin edits —
no code ships from this repo for them except what's noted.**

## How the order carries the ritual
`beginRitual()` now appends **cart attributes** to the checkout permalink:

```
/cart/{variantId}:1?attributes[Protocol]=Performance&attributes[Formulation]=Soursop%20Edge&attributes[Format]=Sticks&attributes[Commitment]=1%20Month
```

So every order has `order.attributes.Protocol / .Formulation / .Format /
.Commitment` in Liquid. (Shopify honoring `attributes[…]` on a cart permalink is
undocumented — verify with one test order. If they don't stick, use the
**line-item fallback** at the bottom.)

`Cohort Nº` and `First delivery` are NOT in the cart — source them per the notes below.

---

## A. First email  — easiest, do this first
**Settings → Notifications → Order confirmation → Edit code.** Replace the body
with `aforce-site/order-confirmed/email.html`, swapping the `{{ TOKEN }}`s:

| Token | Liquid |
|-------|--------|
| `{{ COHORT }}` | `{{ order.customer.metafields.aforce.cohort \| default: order.order_number }}` |
| `{{ PROTOCOL }}` | `{{ attributes.Protocol \| default: "Performance Protocol" }}` |
| `{{ FORMULATION }}` | `{{ attributes.Formulation }}` |
| `{{ FORMAT }}` | `{{ attributes.Format }}` |
| `{{ DELIVERY }}` | `{{ fulfillment.estimated_delivery_at \| date: "%b %-d" \| default: "Ships in 3–5 days" }}` |
| `{{ OS_URL }}` | your AFORCE OS link, e.g. `https://drinkaforce.com/aforce-os` |

(In the order-confirmation email, cart attributes are exposed as `attributes.*`.)

## B. Order status / thank-you page
**Which checkout are you on?**

**B1 — Classic order status page** (Settings → Checkout → *Order status page* →
Additional scripts). Paste this to send buyers to the activation screen:

```html
<script>
  (function(){
    var a = (window.Shopify && Shopify.checkout && Shopify.checkout.attributes) || {};
    var li = (window.Shopify && Shopify.checkout && Shopify.checkout.line_items && Shopify.checkout.line_items[0]) || {};
    var q = new URLSearchParams({
      cohort:      "{{ order.order_number }}",           // or a metafield
      protocol:    a.Protocol    || "Performance Protocol",
      formulation: a.Formulation || (li.title || ""),
      format:      a.Format       || "",
      delivery:    "Ships in 3–5 days"                    // or a Liquid fulfillment date
    });
    window.location.replace("https://drinkaforce.com/order-confirmed/?" + q.toString());
  })();
</script>
```
Repoint the host to wherever `aforce-site` is served. (Redirecting *replaces* the
native thank-you page with the activation screen — the spec's intent. If you'd
rather keep Shopify's page and only restyle, inject the markup instead of
redirecting.)

**B2 — Checkout extensibility** (new checkout; no "Additional scripts"): the
thank-you page is customized with a **Thank-you UI extension**, not raw HTML.
Use `aforce-site/order-confirmed/index.html` as the visual reference; a small
extension reads the same order attributes and renders the manifest. (Out of this
repo — flag if you want it scaffolded.)

---

## Sourcing the two non-cart fields
- **Cohort Nº** — a customer/order metafield (`aforce.cohort`) you set per the
  Founding Cohort, or fall back to `order_number`.
- **First delivery** — `fulfillment.estimated_delivery_at`, or a fixed
  "Ships in 3–5 days".

## Line-item fallback (if cart attributes don't persist)
Derive fields from the line item instead of `attributes.*`:
- **Format** — product handle contains `rtd` → `Cans`, else `Sticks`.
- **Formulation** — the flavor in the variant title (`Watermelon Surge`,
  `Berry Blast`, `Soursop Edge`).
- **Protocol** — `Performance`; `AutoPilot`/membership if the line has a
  `selling_plan`.
- **Commitment** — the duration in the variant title (`1 Month` / `3 Month`) or
  the selling-plan name.

## Last thing
Repoint **DOWNLOAD AFORCE OS** (currently `/aforce-os`) to the real app-store
link once the app is published.
