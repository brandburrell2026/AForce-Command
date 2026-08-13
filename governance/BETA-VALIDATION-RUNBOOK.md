# Beta Validation Runbook — Activation & Device Validation

**Status:** OPERATIVE · **Created:** 2026-08-12 · **Mode:** activation + device validation
(NOT a development wave)

This runbook governs the controlled beta validation run. It exists because of one rule:

> **Tests passing is not validation. Mocks are not evidence.**

The merged E2E lane (#748) proves the *shape* of the commerce chain against Testcontainers.
That is VALIDATED-by-test. It is **not** VERIFIED, and nothing in this runbook may be marked
complete by pointing at it.

---

## 0 · Vocabulary (binding)

| Term | Means | Admissible evidence |
|---|---|---|
| **BUILT** | code exists, typechecks | a merged commit |
| **VALIDATED** | proven by behavioral test | a passing test against a real dependency (e.g. Testcontainers Postgres) |
| **VERIFIED** | observed against the running production system | a request/response, a database row, a provider dashboard record, a device screenshot |

Only **VERIFIED** closes an activation-gate item.

---

## 1 · Founder-only activation items

These are outside Claude's authority. Each needs evidence recorded here before the chain run
begins.

| # | Item | What counts as evidence | Status |
|---|---|---|---|
| 1 | Shopify webhooks registered | Admin API `webhookSubscriptions` returns the four topics with the production callback URL — Claude can re-query and confirm | ☐ |
| 2 | Shopify signing secret matches Railway | a **delivered** webhook that returns 200 (a 401 `invalid_hmac` proves mismatch) | ☐ |
| 3 | Railway `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `PUBLIC_BASE_URL` | a Stripe test event delivered and acknowledged 200 in the Stripe dashboard | ☐ |
| 4 | Additive DB push | `aforce_webhook_deliveries` exists and receives a row during the chain run | ☐ |
| 5 | #756 `baseline-override` | PR merged; CI's `tests-baseline` then measures against 0, not 45 | ☐ |

**Why #2 is called out separately:** an API-registered webhook is signed with the *connecting
app's* secret, which will never match Railway's. Registration must happen in the Shopify admin
UI, and the secret shown there must equal the Railway value. A 401 in the delivery log is the
symptom.

---

## 2 · The chain run

One controlled purchase, followed end to end. **Record the evidence column as you go — an
unrecorded step is an incomplete step.**

| # | Step | Action | Evidence that closes it |
|---|---|---|---|
| 1 | **PURCHASE** | one real controlled purchase (Stripe test mode, or a labelled Shopify test order) | order/session id from the provider dashboard |
| 2 | **WEBHOOK** | provider delivers to `/api/stripe/webhook` or `/api/shopify/webhook` | provider delivery log showing **200**, plus the matching row in `aforce_webhook_deliveries` |
| 3 | **IDENTITY** | the purchase resolves to the right member | the Clerk user id on the created row; for the web rail, the **verified** primary email that matched |
| 4 | **ENTITLEMENT** | entitlement exists server-side | `GET /api/entitlement` with that member's token returns the entitlement (not 401, not empty) |
| 5 | **APP ACTIVATION** | the app reflects it | screenshot of the entitled surface on device |
| 6 | **RESTART** | force-quit and cold-launch | screenshot: still entitled, no re-purchase prompt |
| 7 | **RESTORE** | sign out, sign back in | screenshot: entitlement restored from the server, not from local cache |
| 8 | **REFUND / CANCEL** | refund the Stripe payment or cancel the Shopify order | provider dashboard showing the refund/cancellation |
| 9 | **REVOCATION** | entitlement withdrawn | `GET /api/entitlement` no longer returns it, **and** the app reflects the loss after refresh |

### Adversarial cases (run after the happy path)

| Case | Expectation |
|---|---|
| Duplicate delivery (replay the same webhook id) | ledger dedupes; entitlement unchanged; no double grant |
| Out-of-order delivery (refund before purchase ack) | expiry is monotonic; a late `paid` cannot resurrect a refunded entitlement |
| Unsigned / wrong-secret webhook | rejected 400/401, nothing written |
| Server restart mid-chain | Railway restart between steps 2 and 4; entitlement still resolves |
| Entitlement while offline | app degrades honestly; never silently downgrades a paying member |

---

## 3 · What Claude can verify independently

Once the founder reports activation complete, Claude re-verifies **from outside**, without
taking anyone's word:

- Shopify `webhookSubscriptions` — the topics, and the callback URL
- `/api/healthz/deep` — database, critical-config and cache status
- `/api/entitlement` — fail-closed 401 unauthenticated
- webhook endpoints — reject unsigned traffic
- `/api/admin/metrics` — live and founder-gated
- merged `main` — every Wave-5 commit present **by content**, full lane green, typechecks clean

Claude **cannot** verify from outside: the value of a Railway secret (Wave-3 deliberately fixed
the webhook error body so config state cannot be probed), whether a DB migration ran, or
anything requiring a provider dashboard login. Those need founder-supplied evidence.

---

## 4 · Device QA

Runs against the **actual Wave-5 TestFlight build** — not the simulator, and not build 59,
which predates every Wave-5 change. See `governance/DEVICE-QA-SCRIPT.md`.

---

## 5 · Standing rule

No capability moves to VERIFIED on the strength of a passing test, a code reading, or a
reasonable inference. If the evidence column is empty, the row is open.
