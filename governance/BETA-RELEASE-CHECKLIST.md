# AForce OS — Beta Release Checklist (Wave-4 Part 17)

**Status:** OPERATIVE — the canonical pre-TestFlight-beta gate list.
**Scope:** the operational ship gate for the closed beta. Strategy and launch-scope
blockers stay in `governance/Launch-Readiness.md` (authoritative where they overlap).
**Legend:** `[x]` verified with evidence · `[ ]` open (owner in parentheses).
**Verified as of:** 2026-08-12.

## 1 · Server activation (production Railway)

- [x] Wave-3 server code live on production (endpoint probes 2026-08-12: `/api/healthz`
  200; `/api/healthz/deep` 200 — database ok/critical, critical-config ok, cache honest)
- [x] Entitlement endpoint fail-closed (`/api/entitlement` → 401 unauthenticated, live probe)
- [x] Webhook endpoints fail-closed (Stripe 400 unsigned; Shopify 401 invalid_hmac —
  proves `SHOPIFY_WEBHOOK_SECRET` configured)
- [ ] Merge #738 (Stripe env decoupling) + #744 (metrics endpoint) (founder)
- [ ] Railway env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` (founder)
- [ ] `pnpm --filter @workspace/db push` against production — creates
  `aforce_webhook_deliveries` ledger table (founder)
- [ ] `railway.toml` healthcheckPath → `/api/healthz/deep` one-liner (founder)

## 2 · Client binary

- [x] EAS build 59 finished (id `760f5641`, runtime 1.0.0)
- [x] Build 59 submitted to App Store Connect (submission `e9968c4a`, 2026-08-12) —
  Apple processing → TestFlight
- [ ] Build 59 installed on founder device; cold-launch + auth + Home render smoke (founder)
- [ ] Post-activation build if Railway env changes alter client-visible behavior (Claude, on founder signal)

## 3 · Commerce chain proof (Wave-4 Part 2)

- [ ] Stripe **test-mode** purchase → webhook → `stripe.*` sync → entitlement flip
  (blocked on §1 env + #738 merge)
- [ ] **Shopify webhook registration** — store currently has **ZERO** webhook
  subscriptions (verified via Admin API 2026-08-12): register `orders/paid`,
  `orders/refunded`, `refunds/create`, `orders/cancelled` → JSON →
  `https://aforce-command-production.up.railway.app/api/shopify/webhook` in
  **Shopify admin UI** (Settings → Notifications → Webhooks), and confirm the
  signing secret shown there equals Railway `SHOPIFY_WEBHOOK_SECRET` (founder —
  admin-UI-only: API-registered hooks are signed with the wrong secret)
- [ ] Shopify labeled test order → webhook → `aforce_web_entitlements` grant →
  refund → revoke (after registration)
- [ ] Duplicate-delivery, restart-replay, and failed-delivery retry observed against
  the ledger (covered synthetically in the merged E2E lane; production observation
  follows the two proofs above)

## 4 · Test & CI gates

- [x] Branch protection on `main`: required checks typecheck / tests-baseline /
  integration / focused-health / governance-drift; admin bypass OFF; force-push +
  deletion blocked (applied + verified 2026-08-12)
- [x] Commerce E2E behavioral lane merged and exercised in CI (#748)
- [ ] Baseline burn-down PR: zero unexplained failing tests + failure-classification
  table + DB lane (in flight — workflow `wf_20e06c07`)
- [ ] `db-lane` added to required checks once its CI job exists and is green (Claude)
- [ ] Invariant locks for the 16 golden invariants complete (Part 15, pending audit)

## 5 · Observability & reliability

- [x] Server error observability live: fatal handlers, error middleware, redacted
  logging (#743 merged)
- [ ] Client crash capture ruling — memo at
  `governance/DECISION-W4-CLIENT-CRASH-CAPTURE.md` (founder; recommended: defer to
  TestFlight for beta)
- [ ] Metrics endpoint live behind founder gate (#744 merge + probe)
- [x] Load foundation: tiered k6 suite with fail-closed production guard
  (`artifacts/api-server/loadtests/`); tier-1 read-only smoke run against production
- [ ] Tier-2/3 + recovery runs against a safe environment — **prerequisite: a staging
  deployment or local Docker stack** (founder decision on staging; Docker currently
  unavailable locally)

## 6 · Device & platform coverage

- [ ] iOS device matrix pass (Part 16): iPhone SE-class small screen, standard, Pro
  Max large, Dynamic Type XL, dark mode (Claude — simulator)
- [ ] Real-device pass on founder hardware via TestFlight build 59 (founder)
- [ ]  Android: out of beta scope (no Android build target configured) — recorded, not waived

## 7 · App Store / TestFlight operations

- [x] App Store Connect app exists (id 6783984149); builds 56–59 uploaded
- [ ] TestFlight internal group populated; build 59 assigned (founder)
- [ ] Beta App Review information current (contact, notes for reviewer) (founder)
- [ ] Tester onboarding note: what works, what is dark (later-phase features), how to
  report issues (Claude drafts on founder signal)

## 8 · Governance, legal, privacy

- [x] Claims gate wired at runtime, block-severity (#732); Performance Age™ disclosure
  and sample-data captions live per standing rulings
- [x] Consent-scoped analytics identity (#747)
- [ ] CR-1 pre-launch claims review — prepped, unbooked (founder + counsel; standing
  Launch-Readiness blocker, applies to public launch; beta cohort operates under
  founder supervision)
- [ ] Privacy policy delta review if crash ruling ≠ C (counsel, conditional)

## 9 · Beta operations

- [ ] Beta cohort list + entitlement seeding plan (founder)
- [ ] Feedback intake channel decided (TestFlight feedback vs. direct) (founder)
- [ ] Kill criteria written: what stops the beta (crash-loop on launch, entitlement
  grant failure, score-integrity regression) and the rollback lever for each
  (server: Railway rollback; client: TestFlight build expiry/replacement) (Claude
  drafts in Wave-4 report; founder ratifies)

---
*Maintenance rule: check a box only with evidence (probe output, merged PR, screenshot,
or App Store Connect state). No box is ever checked "because it should be done by now."*
