# Production Clerk Migration Plan

**Status: PLAN ONLY — NOT EXECUTED. Requires founder approval to begin.**
Written 2026-08-13. Read-only document; nothing here has been performed.

Moves AForce OS from the `moving-ox-89` development instance to the **AForce OS →
Production** Clerk application. Current state is documented in
[CLERK-PAIRING-STATE.md](CLERK-PAIRING-STATE.md).

> **TravelGate is not part of this migration.** `clerk.travelgate.app` belongs to a
> separate Clerk application that was paired with AForce by mistake (PR #784). It
> should be removed from consideration entirely, not fixed with DNS.

## What must be true before starting

Five things must line up. Missing any one produces a black screen, a 401 storm, or
a silent identity wipe. **Nothing in this plan is safe to do piecemeal.**

| # | Prerequisite | Who | Verified by |
|---|---|---|---|
| 1 | AForce OS → Production publishable key (`pk_live_…`) obtained | Founder | decode → hostname |
| 2 | Matching `sk_live_` secret from the **same** application | Founder | `scripts/verify-clerk-pairing.mjs` |
| 3 | CNAME for the instance's domain exists and resolves | Founder (DNS provider) | `dig +short <host>` |
| 4 | Clerk dashboard shows the production domain **verified / active** | Founder | Clerk dashboard |
| 5 | Decision made on tester accounts (see below) | Founder | — |

Prerequisites 1 and 2 must come from the *same* Clerk application. The entire
Build 63/64 incident was a client and a server drawn from different applications.

## Tester and account implications — read this before scheduling

**Clerk user IDs are instance-scoped.** Every `aforce_*` table keys rows on
`user_id`, which `requireAuth` takes from the Clerk `sub` claim
(`artifacts/api-server/src/middlewares/requireAuth.ts`). A new Clerk instance mints
entirely new user IDs.

Consequences:

- **Every existing account stops existing.** Testers must re-register. There is no
  sign-in path from a moving-ox-89 identity into the production instance.
- **All existing rows orphan.** Hydration history, intake events, streaks,
  achievements and referrals remain in Postgres keyed to user IDs that no live
  identity will ever present again. They are not deleted — they become unreachable.
- **Referral integrity is affected.** `aforce_referral` stores both
  `referrer_user_id` and `referee_user_id`; both sides orphan together.
- **Founder/role gates re-apply.** `requireFounder`, `requireAdmin` and
  `requireRole` resolve against Clerk. Any role or metadata assigned in the dev
  instance must be re-assigned in the production instance.

Founder decision required, one of:

- **(a) Clean cut** — accept the loss of dev-instance accounts and history. Simplest,
  and defensible pre-launch since all current accounts are internal test accounts.
  **Recommended.**
- **(b) Migrate identities** — export dev users, recreate them in production, and
  remap `user_id` across every `aforce_*` table in one transaction. Significantly
  more work, touches production data, and needs its own written plan and backup.
  Only worth it if real user history must survive.

This plan assumes **(a)** unless the founder rules otherwise.

## Migration order

Each step names its own rollback. Do not batch them.

**1 — Verify the production instance is real and reachable.** Before touching any
configuration: `dig +short <instance-host>` returns records, and Clerk's dashboard
shows the domain verified. *Rollback: none, read-only. If this fails, stop — every
later step depends on it.*

**2 — Set the server secret.** Set `CLERK_SECRET_KEY` (and
`CLERK_PUBLISHABLE_KEY`) on Railway production to the AForce OS → Production
values. Then confirm with
`railway run --service AForce-Command node scripts/verify-clerk-pairing.mjs`,
which must report the production instance and an `sk_live_` prefix.
*Rollback: restore the previous `sk_test_` values; the server returns to accepting
moving-ox-89 tokens immediately on redeploy.*

> The server moves **first, deliberately.** Between steps 2 and 3 the deployed
> server rejects tokens from the still-development clients, so existing internal
> builds will 401 on authenticated requests. That window is intentional and should
> be short — schedule it when no device QA is in flight. Moving the client first
> instead would produce the same outage plus a black screen, which is strictly
> worse and is what happened in Build 63/64.

**3 — Move the client.** Replace `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` on the
`internal`, `preview` and `production` profiles in `artifacts/aforce-os/eas.json`
with the production `pk_live_`. Update `SERVER_CLERK_INSTANCE` in
`artifacts/aforce-os/lib/__tests__/clerkInstancePairing.test.ts` to the value
step 2 printed. The guard must go green **before** any build is cut.
*Rollback: revert the commit; no binary exists yet.*

**4 — Cut the build.** Requires explicit founder approval, as always. Install on a
device with **no prior AForce session** — a cached session will mask an unreachable
instance and reproduce exactly the false pass from Build 63.

**5 — Update governance.** Rewrite `CLERK-PAIRING-STATE.md` to record the new
pairing and lift the public-beta block.

## Verification steps

Run in order; each must pass before the next is meaningful.

1. **DNS** — `dig +short <instance-host>` returns records (not NXDOMAIN).
2. **Clerk frontend API** — `curl -s -o /dev/null -w "%{http_code}" https://<instance-host>/.well-known/jwks.json` returns `200`.
3. **Server pairing** — `railway run --service AForce-Command node scripts/verify-clerk-pairing.mjs` reports the production instance, `sk_live_` prefix, and no development-instance note.
4. **Guard** — `node_modules/.bin/vitest run artifacts/aforce-os/lib/__tests__/clerkInstancePairing.test.ts` passes with `SERVER_CLERK_INSTANCE` updated.
5. **Cold launch** — fresh install, no cached session: the app reaches the sign-in screen rather than a black canvas. *This is the check Build 63 never got.*
6. **Round trip** — register a new account, log an intake, force-close, relaunch: the value persists and Home and Hydration agree.
7. **Failure mode** — confirm an unauthenticated request still 401s. `requireAuth` must not have been weakened anywhere in the process.

## Rollback of the whole migration

If anything fails after step 3, the complete rollback is:

1. Restore Railway's `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` to the
   moving-ox-89 `sk_test_` / `pk_test_` values.
2. Revert the `eas.json` and `SERVER_CLERK_INSTANCE` commit.
3. Reinstall the last known-good internal build.

Accounts created on the production instance during the attempt will not be visible
after rollback — they live in the other instance. This is the main reason to keep
the window between steps 2 and 4 short.

## Explicitly out of scope

- No change to `requireAuth` or any auth semantics.
- No change to Home, HydroState, or any UX code.
- No DNS records for `travelgate.app`. That application is not ours to configure
  for this product.
- No migration of existing user rows unless the founder selects option (b) above,
  which would require its own plan and a verified backup first.
