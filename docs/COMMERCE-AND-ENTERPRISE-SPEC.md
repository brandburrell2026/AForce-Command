# Commerce & Enterprise Specification

**Status:** Canonical (tier 4) · **Updated:** 2026-07-22

Subscription tiers, physical product, and enterprise offerings.

> **Positioning lock governs everything here.** Body first, product last. Commerce follows
> intelligence; it never leads it. A recommendation is earned, never sold.

---

## 1. Consumer subscription tiers

Prices verified from `artifacts/aforce-os/data/subscriptionPlans.ts`.

| Plan | Price | Unlocks |
|---|---|---|
| **Core** | $9.99/mo | Hydration Control Center, Status Pulse + score, basic protocol, basic AI, logging, smart reminders |
| **Recovery+** | $9.99/mo | Adds post-session Recovery Mode |
| **AForce Athlete** | $19.99/mo | Enhanced AI, personalized protocol, advanced recovery, 90-day trends, competition + city/state/team leaderboards, premium notifications, Metabolic Readiness |
| **Performance Bundle** | $59.99/mo | Athlete tier + monthly product drop (1 canister or 2 stick packs) at member pricing, priority AI/insights |
| **AForce Elite** | $99/mo | Guardian Mode (individual), premium analytics, full monthly product bundle, early access, concierge support |

**Meridian™ — Phase 3 premium/luxury tier.** Not yet priced. May consume and expose advanced
AForce Intelligence™ capabilities as a premium experience. **It owns no architecture**
(Founder Decision 2) — no routing, no engine, no gate depends on it.

## 2. Team tiers

| Plan | Price | Seats |
|---|---|---|
| Team Core Starter | $49/mo | ≤ 25 |
| Team Core Growth | $99/mo | ≤ 50 |
| Team Core Pro | $149/mo | ≤ 100 |

Roster-aware, group reporting, admin console.

## 3. Enterprise

**Clutch (live team command):** Starter $1,000/mo · Pro $2,500/mo · Elite $5,000/mo.

**Guardian — "Performance readiness and recovery oversight."**
Core $5,000/mo + $7,500 setup (6-month minimum) · Elite $8,000/mo + $12,500 setup (12-month
minimum).

> **Resolved — `DR-003` (D-06, closed 2026-07-22).** *"Injury-risk protection"* is **removed** as
> an approved Guardian description.
>
> | | Wording |
> |---|---|
> | **Canonical** | "Performance readiness and recovery oversight." |
> | **Permitted secondary** | "Readiness monitoring and escalation support." |
>
> Guardian must **not** claim to predict injury, prevent injury, diagnose injury, assess medical
> risk, or replace medical or emergency care. Escalation language must be based on **observable
> state, user-defined rules, and approved safety boundaries** — never on inferred medical risk.

**Guardian and Clutch are the stated exception to Principle 11** (trust over attention): they
serve a coach/staff safety relationship where active attention during risk windows is the explicit
value delivered. **This exception applies only to Guardian and Clutch** and extends to no other
surface.

## 4. Entitlement

Gated client-side via `useEntitlement.ts`. **Stripe is the source of truth**, mirrored to Postgres
via webhook events. Webhook secret is pulled from the managed Replit Stripe connector, not an env
var.

## 5. Physical product

Catalog model: one SKU per (format × flavor), plus per-format bundles (`data/pricing.ts`,
`data/products.ts`). Subscriber/member pricing is lower than list. Pricing, shipping, and tax are
computed **server-side**.

| Dimension | Values |
|---|---|
| **Formats** | Stick packs (12 ct) · RTD cans (12 pk) · Canisters (30 servings) |
| **Flavors** | Berry · Watermelon · Soursop |
| **Bundles** | Flavor-agnostic multi-packs; flavor split chosen at checkout |

Per-serving sodium and serving sizes are encoded per SKU for the sweat-rate math.

## 6. Hardware

| Product | Phase |
|---|---|
| **Phantom Band™ Core** | Phase 3 |
| **Phantom Meridian** (ceramic luxury edition) | 2027 target |

**Phantom Meridian is a hardware SKU** and is distinct from the Meridian™ software tier
(`governance/TERMINOLOGY-REGISTRY.md` §1). Phantom Band architecture is not to be changed; it
inherits Global Adaptation, Travel Mode, local time/language, Environmental Pressure, and the
Adaptive Performance Profile automatically.

## 7. Commerce constraints

| # | Constraint |
|---|---|
| 1 | **Water first.** A product is never recommended before hydration needs are evaluated. |
| 2 | **No forced recommendation.** When no product is needed, the OS says so. |
| 3 | **Intelligence never gates on commerce.** No engine, route, or gate depends on a paid tier. |
| 4 | **Score Protection.** Product selection never increases score. |
| 5 | **Positioning inherited ecosystem-wide**, including Phantom Band™ and Meridian™. |
