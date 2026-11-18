# AForce OS — Beta Release Checklist (Wave-4 Part 17)

**Status:** OPERATIVE — the canonical pre-TestFlight-beta gate list.
**Scope:** the operational ship gate for the closed beta. Strategy and launch-scope
blockers stay in `governance/Launch-Readiness.md` (authoritative where they overlap).
**Legend:** `[x]` verified with evidence · `[ ]` open (owner in parentheses).
**Verified as of:** 2026-08-12. **Partially re-verified 2026-11-17** — see §10; boxes not named there were not re-checked and may be stale.

## 1 · Server activation (production Railway)

- [x] Wave-3 server code live on production (endpoint probes 2026-08-12: `/api/healthz`
  200; `/api/healthz/deep` 200 — database ok/critical, critical-config ok, cache honest)
- [x] Entitlement endpoint fail-closed (`/api/entitlement` → 401 unauthenticated, live probe)
- [x] Webhook endpoints fail-closed (Stripe 400 unsigned; Shopify 401 invalid_hmac —
  proves `SHOPIFY_WEBHOOK_SECRET` configured)
- [x] Merge #738 (Stripe env decoupling) + #744 (metrics endpoint) — both merged 2026-08-12 (`gh pr view`, checked 2026-11-17)
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

## 10 · Re-verification — 2026-11-17 (`main@6bc3ee3f`)

Partial pass requested by Brandon. Only the lines below were checked; everything else in §1–§9
stands as last verified on 2026-08-12.

**Checked and current**
- Production probes: `/api/healthz` 200, `/api/healthz/deep` 200, `/api/entitlement` 401
  unauthenticated, `/api/aforce/drinks` and `/api/aforce/intake` 401 unauthenticated.
- #738 and #744 merged (§1 box ticked).
- Required checks on `main`: typecheck, tests-baseline, focused-health, governance-drift,
  integration. `db-lane` now runs and passes on PRs but is **not** in the required list (§4 still open).
- `railway.toml` has no `healthcheckPath` (§1 still open).

**Changed since August (supersedes the lines named)**
- §2 client binary: iOS build **159** finished 2026-11-17 (EAS `24351d5c`, profile
  `internal-social`, commit 3533a7fa). TestFlight submission `75fe76e1` failed on an App Store
  Connect server error; re-submit pending. Build 59 lines are historical.
- §6 Android: no longer "no build target". Profile `internal-social-apk` (#1211) built an
  installable APK on 2026-11-17 (EAS `2f2d1c2b`, versionCode 3) after the SkinIA Gradle fix
  (#1212). Whether Android is in beta scope is a founder decision; the line is not waived.
- §6 device pass: the spec v1.8.2 script is `governance/ONE-BREATH-DEVICE-QA.md`, evidence in
  `governance/PROOF-TRACKER.md`. No run logged yet on either platform.

**Open gates not on the original list**
- [ ] **Production Clerk instance.** Client and server are both on the Clerk *development*
  instance; `governance/CLERK-PAIRING-STATE.md` marks public beta as blocked on this. Migration
  plan written, not executed (`governance/PRODUCTION-CLERK-MIGRATION-PLAN.md`) (founder approval)
- [ ] **Stop-ship register re-audit, 2026-11-17** (`governance/AFORCE_OS_STOP_SHIP_REGISTER.md`
  §5): 30 rows — 8 fixed, 1 fixed for store builds only, 11 partly fixed, 10 still open (as updated
  2026-11-18 after #1216–#1218), plus four new items RA-N1..RA-N4 (RA-N1 and RA-N4 closed). Each open S1 needs a fix or an explicit founder acceptance before
  outside testers: SS-03 (tokens stored unencrypted), SS-04 (no in-app account deletion or
  export), SS-05 (BAC / "do not drive" logic still in the build), SS-26 (alcohol logging with no
  age check; hidden from store builds by #1217 on 2026-11-18, age check still missing), and SS-02 (no server entitlement for enterprise surfaces; its client-side "Activate Demo" path, RA-N1, was closed in #1214 on 2026-11-17)
- [ ] `aforce_recorded_drinks` added to the deletion path (`governance/reviews/CR-HYDROSTATE-V2-0.md` §4)

**Not re-checked:** §3 commerce chain (Stripe test purchase, Shopify webhook registration),
§5 crash-capture ruling and load tiers, §7 TestFlight group and reviewer info, §8 CR-1 booking,
§9 beta operations. Railway environment values were not read.

---
*Maintenance rule: check a box only with evidence (probe output, merged PR, screenshot,
or App Store Connect state). No box is ever checked "because it should be done by now."*
