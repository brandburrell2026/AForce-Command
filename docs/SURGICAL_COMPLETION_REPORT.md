# AFORCE Surgical Completion Pass — Final Report

**Repository:** `/Users/brandonburrell/AForce-Command`
**Working branch:** `surgical-completion-pass` (branched from current `origin/main` @ `4e84566c`)
**Status:** NOT deployed, pushed, or merged. Working-branch patch for review.
**Site:** `aforce-site/` — static, multi-page, hosted on Vercel (no build step).

---

## 1. Commits (10, oldest → newest)

| Commit | Scope |
|---|---|
| `9440b147` | §11 AutoPilot → real subscription, never one-time |
| `bffe6754` | §6 Core/Command, §8 Travel→Soursop+AutoPilot, §13 remove free shipping |
| `cf6c8f54` | §4/§5/§6/§7 universal header + drawer + hero CTA on the Shop |
| `dec7c6ca` | §4/§7 universal header + drawer on the other five routes |
| `07d92cf0` | §7 remove nested-interactive format cards + aria-live |
| `a0cb730c` | §9/§12/§15 multi-product basket engine (adapter + controller) |
| `dd2edfc6` | §9 YOUR RITUAL basket drawer UI |
| `e3ed432a` | §16 favicon + canonical + social metadata (six routes) |
| `bfa92e49` | §21 horizontal-overflow root-cause fixes |
| `6b4b3bac` | §14 security headers (vercel.json) |

14 files changed, +1407 / −223. No image, video, or scoring-engine files changed.

## 2. Files changed & why

- `assets/header.css`, `assets/header.js` (new) — universal header + drawer.
- `assets/commerce.js` (new) — the Shopify commerce boundary (§12).
- `assets/basket.js` (new) — YOUR RITUAL basket controller (§9/§15).
- `assets/favicon.svg` (new) — N–И monogram favicon.
- `shop/index.html` — Core/Command, Travel, free-shipping removal, header, hero
  CTA, product-card a11y, basket drawer, metadata, overflow fix.
- `index.html`, `science/`, `our-story/`, `manifesto/`, `aforce-os/` — universal
  header adoption + metadata.
- `api/_lib/mutations.js`, `api/cart/create.js` — cart attributes passthrough.
- `vercel.json` — security headers.

## 3. What was implemented (by area)

**Universal header (§4)** — one component across all six routes. Desktop ≥1024:
RITUAL | THE OS | OUR STORY | SCIENCE | MANIFESTO | SHOP (button) | CART, 76px.
Compact <1024: logo + SHOP + CART + hamburger, 64px. "The Standard" and "Home"
removed from nav everywhere. Per-page treatment preserved (Shop warm-white,
homepage transparent→solid, manifesto mix-blend-mode).

**Mobile/tablet drawer (§7)** — 6 links, SHOP as full-width button; focus trap,
Escape, backdrop-close, link-close, scroll-lock (no sideways shift), focus
returns to hamburger, z-index above the ritual bar. Works on all six routes.

**Homepage logo (§4)** — clickable → `/` on every page including home.

**Shop CTA (§5)** — "Begin the Ritual" → `#stepDemand`, scroll-margin, reduced-
motion respected.

**Core/Command (§6)** — Athlete removed; Core $0 + Command $20/mo, $200/yr,
SAVE $40; MONTHLY|ANNUAL segmented control; "Command included" when AutoPilot.
No black section, existing tokens only.

**Product-card accessibility (§7)** — outer format cards are now plain
containers; real "Choose" buttons carry aria-pressed; aria-live announcements.

**Travel recommendation (§8)** — Travel → Soursop Edge + AutoPilot; respects
later changes; never resets on re-render. Other mappings unchanged.

**Multi-product basket (§9)** — "Add to Ritual" builds a multi-line Shopify cart
via the Storefront Cart API; drawer with thumbnail/plan/qty±/EDIT/REMOVE, undo,
empty state, COMMAND INCLUDED, "Continue to secure checkout". Line identity =
variant + selling plan; optimistic updates with rollback; serialised mutations;
cart persists across reload/back.

**Checkout / AutoPilot (§11)** — subscriptions go through cartCreate +
sellingPlanId (permalinks silently drop selling plans, per Shopify docs). The
Shop refuses to hand off unless Shopify confirms the plan applied; open-redirect
guard validates every checkout URL.

**Selling-plan verification (§10)** — expected `2501607542` == verified active
`2501607542` (group `1547403382` "Ritual Membership", MONTH×1, both products).

**No free shipping (§13)** — FREE_SHIP constant, progress-bar markup, CSS and
threshold logic all removed; "Shipping calculated at checkout".

**Commerce boundary (§12)** — all Shopify specifics behind `AForceCommerce`;
UI calls same-origin `/api/cart/*`; token stays server-side.

**Security (§14)** — vercel.json headers: HSTS, nosniff, Referrer-Policy,
X-Frame-Options, Permissions-Policy enforced; CSP as Report-Only.

**Metadata/favicon (§16)** — favicon.svg (N–И monogram) on all routes; www
canonicals; Shop + Science full OG/Twitter; broken og-image.jpg replaced with
real posters; all social images absolute + HTTP 200.

**Responsive/overflow (§21)** — ritual-bar chip rail min-width:0 + compact-header
spacing; no horizontal scroll 320→1440.

## 4. Verification run

- `node --check`: all changed JS + both inline page scripts — PASS.
- JSON/SVG validity (vercel.json, favicon.svg) — PASS.
- `git diff --check` — clean.
- Viewport sweep 320/375/412/768/1023/1024/1440: heights 64/76 correct,
  breakpoint correct at 1024, no horizontal scroll, hamburger within viewport.
- Basket engine (stateful mock): merge/keep-separate by variant+plan, qty
  update, remove-one-untouched, undo exact restore, persistence, expired-cart
  reset, rapid-tap no-double-add, failed-update rollback — PASS.
- Basket UI: Add to Ritual, two flavors → two lines, qty±, remove+undo, edit,
  COMMAND INCLUDED, empty state, Escape/backdrop/lock — PASS.
- Regression text: no "The Standard" in nav, no "Athlete"/"$19.99", no free
  shipping copy/logic, "Perfomance" absent, Founding 250 (×19, no 200/500),
  $20/$200/SAVE $40 present — PASS.
- `aforce-site` is static (no build/lint/unit-test step); the monorepo TS build
  targets `artifacts/`, not this site.

## 5. Screenshots captured (in-session)

Desktop Shop header; desktop homepage header (overlay hero); mobile Shop header
(closed) + open drawer; mobile homepage drawer; manifesto header (blend-mode);
Core/Command band; **populated YOUR RITUAL basket** (3-item + COMMAND INCLUDED);
favicon render. The in-app browser pane returned blank frames for many
*scrolled* captures — DOM measurement was the reliable signal throughout. The
full §24 set of 20 should be captured on staging with a real browser.

## 6. Commerce before/after (unchanged unless noted)

| Item | Value | Changed? |
|---|---|---|
| Product IDs | sticks `8162309046390`, RTD `8162573615222` | no |
| Variant IDs | as on origin/main | no |
| Selling plan | `2501607542` (verified active) | no |
| Prices | sticks $59.99, cans $29.99 | no |
| Pack structures | as-is | no |
| AutoPilot billing | monthly (MONTH×1) | no |
| Product images | as-is | no |
| Checkout construction | permalink → **Storefront Cart API for subscriptions** | YES (§11, intended) |

## 7. Selling-plan verification report (§10)

- Expected ID: `2501607542`
- Verified active ID: `2501607542` — MATCH
- Verification source: Shopify Admin API (read-only), per-product query
- Group: `1547403382` "Ritual Membership", app-owned (`App/66228322305`)
- Billing: interval MONTH, intervalCount 1
- Attached to: both hydration products; confirmed on individual variants
- **Method caution:** the top-level `sellingPlanGroups` query returns `[]`
  (app-owned groups are hidden) — must query per-product, or you get a false
  negative.

---

## LAUNCH BLOCKERS — owner action required

1. **AutoPilot 10% discount** — plan `2501607542` has NO pricing policy
   (`pricingPolicies: []`). The Shop shows $53.99/$26.99 (10% off), but a real
   subscription would charge full $59.99/$29.99. Add a 10% percentage pricing
   policy to the plan in Shopify Admin, or the displayed discount is inaccurate.
2. **Command app pricing** — the Shop shows $20/mo, $200/yr. Command billing
   lives in the AFORCE OS app and cannot be verified from this repo. Confirm the
   app charges $20/$200 (not $19.99) before launch.
3. **Storefront env vars** — the cart API is gated behind `SHOP_PREVIEW_ENABLED`
   and needs `SHOPIFY_STORE_DOMAIN` + `SHOPIFY_STOREFRONT_ACCESS_TOKEN` set in
   Vercel. The basket + subscription checkout were tested against a mock of the
   cart API; **live end-to-end (real merge, checkout receiving the right lines +
   plans, paid shipping option) must be verified on staging.**

## Shopify Admin checklist (external settings I cannot verify)

- [ ] 10% pricing policy on selling plan `2501607542`
- [ ] Command product/billing charges $20/$200 (not $19.99)
- [ ] Storefront token + `SHOP_PREVIEW_ENABLED=1` set on the aforce-site project
- [ ] No automatic free-shipping discounts / codes / $0 shipping profiles /
      subscription free-shipping rules / theme announcement bars
- [ ] Access review: phishing-resistant MFA, no shared admin accounts,
      least-privilege staff, DNS registrar MFA + domain lock, hosting MFA
- [ ] After reviewing CSP Report-Only violations on staging, switch the header
      name to `Content-Security-Policy` to enforce (tighten `'unsafe-inline'`).

## Flags for confirmation (non-blocking)

- **Favicon** — `favicon.svg` reproduces the existing N–И monogram; confirm it's
  acceptable or supply the official asset to swap in.
- **Science OG description** — set to §16's exact text; the page's existing
  `<meta name="description">` was left intact. Unify if desired.

## Legal note (required verbatim)

> BRANDON/COUNSEL VERIFICATION REQUIRED: Confirm that "U.S. patent pending" is
> supported by a real pending U.S. patent application before launch.

(The "U.S. patent pending" line in the Shop was left unchanged — not removed,
strengthened, or rewritten.)

## Rollback

The work is isolated on `surgical-completion-pass`. To discard:
`git checkout main && git branch -D surgical-completion-pass`. No commits were
made to `main`; nothing pushed or merged.
