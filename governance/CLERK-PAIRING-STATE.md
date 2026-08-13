# Clerk Pairing State

**Status: TEMPORARY QA CONFIGURATION — public beta is BLOCKED on this.**
Last verified 2026-08-13 against Railway `affectionate-gratitude / production / AForce-Command`.

## Current pairing

| Side | Clerk instance | Mode |
|---|---|---|
| **Client** (`eas.json` → `internal`, `preview`, `production`) | `moving-ox-89.clerk.accounts.dev` | development |
| **Server** (Railway `CLERK_SECRET_KEY`) | `moving-ox-89.clerk.accounts.dev` | development |

- **Client = moving-ox-89 development**
- **Server = moving-ox-89 development**
- **Acceptable for internal TestFlight QA only**
- **BLOCKED for public beta**

The two sides match, which is the only property that makes authenticated requests
work at all. Both being a *development* instance is the part that is temporary.

## Why a development instance is not shippable

Clerk development instances are not a smaller production — they are a different
product tier: relaxed security posture, short session lifetimes, hard rate limits,
and no custom domain. They are intended for local work, not for binaries handed to
people. Internal TestFlight QA on a handful of known devices is an acceptable use.
Public beta is not.

Migration to AForce OS → Production is planned in
[PRODUCTION-CLERK-MIGRATION-PLAN.md](PRODUCTION-CLERK-MIGRATION-PLAN.md). It is
written but **not executed** and requires founder approval.

## How this state came about

Builds ≤62 were already correctly paired: client `pk_test_` and server `sk_test_`,
both moving-ox-89. The write failures in builds 59–62 were caused solely by a
missing `EXPO_PUBLIC_API_BASE` (PR #783).

A second defect was then diagnosed — a "Clerk instance mismatch" — on the reading
that Railway held an `sk_live_` secret. It does not; it holds `sk_test_`. Acting on
that misreading, PR #784 moved the client onto `pk_live_…` for
`clerk.travelgate.app`, a **different Clerk application** (TravelGate) that the
server was never paired with and whose hostname does not resolve.

Consequences, in order:

1. Client and server were no longer on the same instance, so every authenticated
   request would have failed with 401.
2. `clerk.travelgate.app` is NXDOMAIN, so `ClerkProvider` could never initialise.
   `app/index.tsx` waits on `isLoaded` and renders a black canvas while it waits —
   so the app did not crash, it hung. **This is the Build 63/64 black screen.**
3. Build 63's device write test genuinely passed, because the device still held a
   cached moving-ox-89 session from Build 62 that the `sk_test_` server accepted.
   The test was real; it exercised the old pairing. Reinstalling cleared the cache
   and the black screen appeared on the same binary.

The client was then reverted to moving-ox-89, restoring the pairing that Build 63's
write test actually validated.

## Standing lessons

- **A configuration claim is not evidence until a machine confirms it.** The
  `sk_live_` reading was accepted secondhand when `railway run` could have settled
  it in one command. It is now settled by `scripts/verify-clerk-pairing.mjs`.
- **`production API host ⟹ pk_live_` is not a rule.** It conflates *which
  deployment* with *which Clerk instance*. Encoding it as a guard is what made the
  wrong fix look principled. The only real rule is
  `client Clerk instance == server Clerk instance`.
- **A cached Clerk session masks an unreachable instance.** Device QA can pass on a
  configuration that cannot launch from cold. Passing device QA does not prove the
  instance is reachable; only DNS + a fresh install does.

## Guardrails now in place

- `artifacts/aforce-os/lib/__tests__/clerkInstancePairing.test.ts` — enforces
  client == server across all native release profiles, requires the key to be
  declared in `eas.json` rather than inherited from the EAS dashboard, checks the
  instance resolves in DNS, and rejects any `sk_` in `eas.json`. It asserts
  **nothing** about `pk_live_` vs `pk_test_`.
- `scripts/verify-clerk-pairing.mjs` — proves the server half against the live
  deployment without exposing the secret. Re-run it whenever Railway's Clerk
  configuration changes and update `SERVER_CLERK_INSTANCE` to match.

## Open item

The EAS dashboard also holds `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` values, including
one marked as a *secret* EAS variable that cannot be read back in any UI. Values in
`eas.json` take precedence at build time — confirmed empirically, since Build 63/64
used the `eas.json` key — so this does not affect the current fix. It is still worth
a human look, because an unreadable shadow value is a future misdiagnosis waiting to
happen.
